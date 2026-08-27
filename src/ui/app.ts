import { SemanticEngine } from '../engine/nlp';
import { LexiconRenderer } from '../engine/renderer';
import { LexiconDB } from '../storage/db';
import { LexiconViz } from '../viz/sigil';
import { AppConfig, NLPLevel, Reading } from '../types';

export class LexiconApp {
  private engine: SemanticEngine;
  private renderer: LexiconRenderer;
  private db: LexiconDB;
  private viz: LexiconViz;
  private config: AppConfig = {
    nlpLevel: 'standard',
    dampingFactor: 0.85,
    clusteringSensitivity: 12,
    blacklist: new Set(['the', 'and', 'was', 'for', 'with', 'that', 'this', 'but', 'from', 'they'])
  };

  constructor() {
    this.engine = new SemanticEngine(this.config);
    this.renderer = new LexiconRenderer();
    this.db = new LexiconDB();
    this.viz = new LexiconViz('viz-container');
    this.init();
  }

  async init() {
    await this.db.init();
    const savedConfig = await this.db.getConfig();
    if (savedConfig) {
      this.config = savedConfig;
      this.engine.config = this.config;
    }
    this.setupEventListeners();
    this.updateUIFromConfig();
    this.renderHistory();

    // Auto-focus input
    document.getElementById('speak-input')?.focus();
  }

  private setupEventListeners() {
    const listeners: Array<{ id: string, type: string, handler: (e: Event) => void }> = [
        {
            id: 'speak-input',
            type: 'input',
            handler: (e) => {
                const input = e.target as HTMLTextAreaElement;
                this.handleInput(input.value);
                input.style.height = 'auto';
                input.style.height = input.scrollHeight + 'px';
            }
        },
        { id: 'cast-btn', type: 'click', handler: () => this.cast() },
        {
            id: 'settings-toggle',
            type: 'click',
            handler: () => {
                document.getElementById('settings-sidebar')?.classList.toggle('collapsed');
                document.getElementById('history-sidebar')?.classList.add('collapsed');
            }
        },
        { id: 'settings-close', type: 'click', handler: () => document.getElementById('settings-sidebar')?.classList.add('collapsed') },
        {
            id: 'history-toggle',
            type: 'click',
            handler: () => {
                document.getElementById('history-sidebar')?.classList.toggle('collapsed');
                document.getElementById('settings-sidebar')?.classList.add('collapsed');
            }
        },
        { id: 'history-close', type: 'click', handler: () => document.getElementById('history-sidebar')?.classList.add('collapsed') },
        { id: 'save-settings', type: 'click', handler: () => this.saveSettings() },
        { id: 'clear-btn', type: 'click', handler: () => this.clear() },
        { id: 'copy-btn', type: 'click', handler: () => this.copyLastReading() },
        {
            id: 'damping-factor',
            type: 'input',
            handler: (e) => document.getElementById('damping-val')!.textContent = (e.target as HTMLInputElement).value
        },
        {
            id: 'cluster-sensitivity',
            type: 'input',
            handler: (e) => document.getElementById('cluster-val')!.textContent = (e.target as HTMLInputElement).value
        }
    ];

    listeners.forEach(({ id, type, handler }) => {
        document.getElementById(id)?.addEventListener(type, handler);
    });
  }

  private handleInput(text: string) {
    if (text.endsWith('.') || text.endsWith('\n') || text.endsWith(' ') || text.endsWith('?') || text.endsWith('!')) {
        this.engine.addText(text);
        this.viz.update(this.engine);
        this.updateStats();
        document.getElementById('vocab-empty')!.style.display = this.engine.nodeCount > 0 ? 'none' : 'flex';
    }
  }

  private updateStats() {
    const n = this.engine.nodeCount;
    const btn = document.getElementById('cast-btn') as HTMLButtonElement;
    if (n >= 4) {
        btn.disabled = false;
        btn.textContent = 'CAST';
        btn.classList.add('ready');
    } else {
        btn.disabled = true;
        btn.textContent = `${4-n} more terms to cast`;
        btn.classList.remove('ready');
    }
  }

  private updateUIFromConfig() {
      (document.getElementById('nlp-level') as HTMLSelectElement).value = this.config.nlpLevel;
      (document.getElementById('damping-factor') as HTMLInputElement).value = this.config.dampingFactor.toString();
      document.getElementById('damping-val')!.textContent = this.config.dampingFactor.toString();
      (document.getElementById('cluster-sensitivity') as HTMLInputElement).value = this.config.clusteringSensitivity.toString();
      document.getElementById('cluster-val')!.textContent = this.config.clusteringSensitivity.toString();
      (document.getElementById('word-blacklist') as HTMLTextAreaElement).value = Array.from(this.config.blacklist).join(', ');
  }

  private async saveSettings() {
      const nlpLevel = (document.getElementById('nlp-level') as HTMLSelectElement).value as NLPLevel;
      const damping = parseFloat((document.getElementById('damping-factor') as HTMLInputElement).value);
      const sensitivity = parseInt((document.getElementById('cluster-sensitivity') as HTMLInputElement).value);
      const blacklist = new Set((document.getElementById('word-blacklist') as HTMLTextAreaElement).value.split(',').map(s => s.trim()).filter(s => s.length > 0));

      this.config = { nlpLevel, dampingFactor: damping, clusteringSensitivity: sensitivity, blacklist };
      this.engine.config = this.config;
      await this.db.saveConfig(this.config);

      this.engine.processNLP();
      this.viz.update(this.engine);

      document.getElementById('settings-sidebar')?.classList.add('collapsed');
  }

  private lastReading: Reading | null = null;

  private cast() {
    const reading = this.renderer.cast(this.engine);
    if (reading) {
        this.lastReading = reading;
        this.db.saveReading(reading);
        this.displayReading(reading);
        this.renderHistory();
    }
  }

  private displayReading(reading: Reading) {
      this.lastReading = reading;
      document.getElementById('reading-card')?.classList.add('visible');
      document.getElementById('cast-number')!.textContent = `◈ CAST ${reading.castNumber} ◈`;
      document.getElementById('reading-sign')!.textContent = reading.sign;

      const bodyEl = document.getElementById('reading-body')!;
      bodyEl.innerHTML = '';
      reading.body.forEach(line => {
          const div = document.createElement('div');
          div.className = 'reading-line';
          div.textContent = line;
          bodyEl.appendChild(div);
      });

      document.getElementById('reading-thread')!.textContent = reading.thread;
      document.getElementById('reading-seal')!.textContent = reading.seal;
      document.getElementById('reading-stats')!.textContent = `${reading.termCount} terms · ${reading.clusterCount} currents`;

      const rv = document.getElementById('reading-view');
      if (rv) {
          rv.scrollTo({ top: 0, behavior: 'smooth' });
          rv.style.pointerEvents = 'auto';
      }
  }

  private async renderHistory() {
      const history = await this.db.getHistory();
      const list = document.getElementById('history-list')!;
      list.innerHTML = '';

      history.reverse().forEach(reading => {
          const item = document.createElement('div');
          item.className = 'history-item';
          item.innerHTML = `
              <div class="h-meta">CAST ${reading.castNumber}</div>
              <div class="h-sign">${reading.sign}</div>
          `;
          item.addEventListener('click', () => {
              this.displayReading(reading);
              document.getElementById('history-sidebar')?.classList.add('collapsed');
          });
          list.appendChild(item);
      });
  }

  private clear() {
      this.engine = new SemanticEngine(this.config);
      this.viz.update(this.engine);
      this.updateStats();
      this.lastReading = null;
      document.getElementById('vocab-empty')!.style.display = 'flex';
      document.getElementById('reading-card')?.classList.remove('visible');
      (document.getElementById('speak-input') as HTMLTextAreaElement).value = '';
      const rv = document.getElementById('reading-view');
      if (rv) rv.style.pointerEvents = 'none';
  }

  private copyLastReading() {
      if (!this.lastReading) return;
      const r = this.lastReading;
      const text = [
          `THE LEXICON — CAST ${r.castNumber}`,
          '',
          r.sign,
          '',
          ...r.body,
          '',
          r.thread,
          '',
          r.seal,
          '',
          `${r.termCount} terms · ${r.clusterCount} currents`
      ].join('\n');

      navigator.clipboard.writeText(text).then(() => {
          const btn = document.getElementById('copy-btn')!;
          const orig = btn.textContent;
          btn.textContent = 'COPIED';
          setTimeout(() => btn.textContent = orig, 1500);
      });
  }
}
