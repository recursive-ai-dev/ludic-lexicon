import { Reading, Node } from '../types';
import { SemanticEngine } from './nlp';

const pick = (arr: string[], seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    return arr[Math.abs(hash) % arr.length];
};

export class LexiconRenderer {
  private castCount: number = 0;
  private verbs = ["ascends", "dissolves", "resonates", "collects", "vibrates", "echoes", "drifts", "crystallizes", "flows", "rests", "intertwines", "manifests", "recedes"];
  private preps = ["within", "above", "towards", "against", "beneath", "around", "inside", "upon", "beyond", "throughout"];
  private abstracts = ["geometry", "memory", "weight", "frequency", "echo", "shadow", "lattice", "impulse", "symmetry", "static"];
  private lore = ["the stars align", "the circle breaks", "silence falls", "the current reverses", "the thread snaps", "the signal clears"];
  private sounds = ["hum", "crackle", "ringing", "static", "rhythm", "tone", "pulse", "murmur"];
  private sensations = ["colder", "heavier", "brightly", "softly", "distant", "sharp", "fragile"];
  private temporals = ["was once", "now", "becoming", "until", "eternally", "briefly"];

  private formulas = [
    (a: string, b: string, s: string) => `${a} ${pick(this.verbs, s + "v0")} ${pick(this.preps, s + "p0")} ${b}`,
    (a: string, b: string, s: string) => `the ${a} of ${b}`,
    (a: string, b: string, s: string) => `${a} — ${pick(this.abstracts, s + "ab0")} — ${b}`,
    (a: string, b: string, s: string) => `${b} ${pick(this.temporals, s + "t0")} ${a} ${pick(this.verbs, s + "v1")}`,
    (a: string, b: string, s: string) => `what ${a} ${pick(this.verbs, s + "v2")}: ${b}`,
    (a: string, b: string, s: string) => `${pick(this.sounds, s + "sn0")} — ${a} ${pick(this.preps, s + "p1")} ${b}`,
    (a: string, b: string, s: string) => `${a} ${pick(this.sensations, s + "se0")}, ${b} ${pick(this.verbs, s + "v3")}`,
    (a: string, b: string, s: string) => `${b} and ${a} ${pick(this.verbs, s + "v4")}`,
  ];

  cast(engine: SemanticEngine, anchor: string | null = null): Reading | null {
    const ranked = engine.getRankedTerms();
    if (ranked.length < 4) return null;

    this.castCount++;
    const N = this.castCount;
    const seed = `C${N}_${engine.nodeCount}_${anchor || ""}`;

    const clusters = engine.getClusters(12);
    let axis = anchor || ranked[0].word;
    let bridge = ranked[1]?.word || axis;
    if (bridge === axis) bridge = ranked[2]?.word || "current";

    let outlier = ranked[Math.min(ranked.length - 1, 15)].word;

    const pool = ranked.map(r => r.word).filter(w => w !== axis && w !== bridge && w !== outlier);
    const T = (i: number) => pool[i % Math.max(1, pool.length)] || axis;

    const sign = this._buildSign(axis, bridge, seed);
    const body = this._buildBody(ranked, clusters, axis, bridge, outlier, T, seed, engine.nodeCount);

    const threadPrefix = pick(["The thread", "A current", "The resonance", "Spectral lattice"], seed + "tp");
    const thread = `${threadPrefix} ${pick(this.verbs, seed + "tv")} through ${outlier}`;
    const seal = outlier.toUpperCase();

    return {
      castNumber: N,
      date: new Date(),
      sign,
      body,
      thread,
      seal,
      ranked: ranked.slice(0, 10),
      clusters,
      termCount: ranked.length,
      clusterCount: clusters.length,
      axis
    };
  }

  private _buildSign(axis: string, bridge: string, seed: string) {
    const forms = [
      `${axis} / ${bridge}`,
      `the ${axis} of ${bridge}`,
      `${axis} — ${bridge}`,
      `${bridge} upon ${axis}`,
    ];
    return pick(forms, seed + "sign").toUpperCase();
  }

  private _buildBody(ranked: any[], clusters: string[][], axis: string, bridge: string, outlier: string, T: (i: number) => string, seed: string, nodeCount: number): string[] {
    const lines = [];
    if (nodeCount < 8) {
        lines.push(this._formula(0, axis, bridge, seed + "L0"));
        lines.push(this._formula(1, T(0), outlier, seed + "L1"));
    } else if (nodeCount < 20) {
        lines.push(this._formula(2, axis, clusters[0]?.[0] || bridge, seed + "L0"));
        lines.push(this._formula(3, clusters[1]?.[0] || bridge, T(1), seed + "L1"));
        lines.push(this._formula(5, T(2), outlier, seed + "L2"));
    } else {
        lines.push(this._formula(4, axis, clusters[0]?.[0] || bridge, seed + "L0"));
        lines.push(this._formula(6, clusters[1]?.[0] || bridge, clusters[2]?.[0] || T(3), seed + "L1"));
        lines.push(this._formula(7, T(4), outlier, seed + "L2"));
        lines.push(this._formula(1, T(5), T(6), seed + "L3"));
    }
    return lines;
  }

  private _formula(idx: number, a: string, b: string, seed: string) {
    const f = this.formulas[idx % this.formulas.length];
    return f(a, b, seed);
  }
}
