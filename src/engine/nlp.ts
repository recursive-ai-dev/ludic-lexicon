import { Node, AppConfig } from '../types';

export class SemanticEngine {
  graph: Map<string, Node> = new Map();
  totalDocs: number = 0;
  config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !this.config.blacklist.has(w));
  }

  addText(text: string) {
    const toks = this.tokenize(text);
    if (toks.length === 0) return;
    this.totalDocs++;

    for (const w of toks) {
      if (!this.graph.has(w)) {
        this.graph.set(w, { frequency: 0, neighbors: new Map(), idf: 0 });
      }
      const node = this.graph.get(w)!;
      node.frequency++;
    }

    const windowSize = this.config.nlpLevel === 'dense' ? 6 : 4;
    for (let i = 0; i < toks.length; i++) {
      const node = this.graph.get(toks[i])!;
      const start = Math.max(0, i - windowSize);
      const end = Math.min(toks.length - 1, i + windowSize);

      for (let j = start; j <= end; j++) {
        if (i === j) continue;
        const neighbor = toks[j];
        if (this.config.blacklist.has(neighbor)) continue;

        let weight = 1 / Math.abs(i - j);
        // In Dense mode, amplify weights of rare connections
        if (this.config.nlpLevel === 'dense') {
            const neighborNode = this.graph.get(neighbor);
            if (neighborNode) weight *= (neighborNode.idf || 1);
        }

        node.neighbors.set(neighbor, (node.neighbors.get(neighbor) || 0) + weight);
      }
    }

    this._updateIDF();
    this.processNLP();
  }

  private _updateIDF() {
    for (const [_, node] of this.graph) {
      node.idf = Math.log(this.totalDocs / (1 + node.frequency)) + 1;
    }
  }

  processNLP() {
    const damping = this.config.dampingFactor;
    switch (this.config.nlpLevel) {
      case 'fragmentary':
        this._textRank(5, damping);
        break;
      case 'standard':
        this._textRank(15, damping);
        break;
      case 'dense':
        this._textRank(30, damping);
        this._hits(20);
        break;
    }
  }

  private _textRank(iters: number, d: number) {
    const words = Array.from(this.graph.keys());
    const n = words.length;
    if (n === 0) return;

    let ranks = new Map<string, number>();
    words.forEach(w => ranks.set(w, 1 / n));

    // Precompute edge sums to avoid recalculating in inner loop
    for (const w of words) {
      const node = this.graph.get(w)!;
      let edgeSum = 0;
      for (const [_, wgt] of node.neighbors) edgeSum += wgt;
      node.edgeSum = edgeSum;
    }

    for (let i = 0; i < iters; i++) {
      const nextRanks = new Map<string, number>();
      for (const w of words) {
        let sum = 0;
        const node = this.graph.get(w)!;
        for (const [neighbor, weight] of node.neighbors) {
          const neighborNode = this.graph.get(neighbor);
          if (!neighborNode) continue;
          sum += (weight * (ranks.get(neighbor) || 0)) / (neighborNode.edgeSum || 1);
        }
        nextRanks.set(w, (1 - d) / n + d * sum);
      }
      ranks = nextRanks;
    }

    for (const [w, r] of ranks) {
      const node = this.graph.get(w);
      if (node) node.rank = r;
    }
  }

  private _hits(iters: number) {
    const words = Array.from(this.graph.keys());
    for (const w of words) {
      const node = this.graph.get(w)!;
      node.hitsHub = 1;
      node.hitsAuthority = 1;
    }

    for (let i = 0; i < iters; i++) {
      let normA = 0;
      for (const w of words) {
        const node = this.graph.get(w)!;
        node.hitsAuthority = 0;
        for (const [neighbor, weight] of node.neighbors) {
            node.hitsAuthority += (this.graph.get(neighbor)?.hitsHub || 0) * weight;
        }
        normA += node.hitsAuthority ** 2;
      }
      normA = Math.sqrt(normA) || 1;
      for (const w of words) this.graph.get(w)!.hitsAuthority! /= normA;

      let normH = 0;
      for (const w of words) {
        const node = this.graph.get(w)!;
        node.hitsHub = 0;
        for (const [neighbor, weight] of node.neighbors) {
            node.hitsHub += (this.graph.get(neighbor)?.hitsAuthority || 0) * weight;
        }
        normH += node.hitsHub ** 2;
      }
      normH = Math.sqrt(normH) || 1;
      for (const w of words) this.graph.get(w)!.hitsHub! /= normH;
    }
  }

  getClusters(limit: number): string[][] {
    if (this.graph.size === 0) return [];
    if (this.config.nlpLevel === 'fragmentary') return this._simpleClustering(limit);
    return this._louvainClustering(limit);
  }

  private _simpleClustering(limit: number): string[][] {
    const parent = new Map<string, string>();
    for (const w of this.graph.keys()) {
        parent.set(w, w);
    }
    const find = (i: string): string => {
        if (parent.get(i) === i) return i;
        const r = find(parent.get(i)!);
        parent.set(i, r);
        return r;
    };
    const union = (i: string, j: string) => {
        const ri = find(i);
        const rj = find(j);
        if (ri !== rj) parent.set(ri, rj);
    };

    const edges: {u: string, v: string, w: number}[] = [];
    for (const [u, node] of this.graph) {
        for (const [v, w] of node.neighbors) {
            if (u < v) edges.push({u, v, w});
        }
    }
    edges.sort((a,b) => b.w - a.w);
    const threshold = edges.length > 0 ? edges[Math.min(edges.length-1, this.config.clusteringSensitivity * 2)]?.w || 0 : 0;
    edges.filter(e => e.w >= threshold).forEach(e => union(e.u, e.v));

    const groups = new Map<string, string[]>();
    for (const w of this.graph.keys()) {
        const root = find(w);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root)!.push(w);
    }
    return Array.from(groups.values()).sort((a,b) => b.length - a.length).slice(0, limit);
  }

  private _louvainClustering(limit: number): string[][] {
    const words = Array.from(this.graph.keys());
    let communities = new Map<string, string>();
    words.forEach(w => communities.set(w, w));

    let changed = true;
    let passes = 0;
    while (changed && passes < 10) {
        changed = false;
        passes++;
        for (const nodeName of words) {
            const node = this.graph.get(nodeName)!;
            const currentComm = communities.get(nodeName)!;
            const neighborComms = new Map<string, number>();
            for (const [neighbor, weight] of node.neighbors) {
                const c = communities.get(neighbor)!;
                neighborComms.set(c, (neighborComms.get(c) || 0) + weight);
            }
            let bestComm = currentComm;
            let maxWeight = 0;
            for (const [comm, w] of neighborComms) {
                if (w > maxWeight) { maxWeight = w; bestComm = comm; }
            }
            if (bestComm !== currentComm) {
                communities.set(nodeName, bestComm);
                changed = true;
            }
        }
    }
    const groups = new Map<string, string[]>();
    for (const [node, comm] of communities) {
        if (!groups.has(comm)) groups.set(comm, []);
        groups.get(comm)!.push(node);
    }
    return Array.from(groups.values()).sort((a, b) => b.length - a.length).slice(0, limit);
  }

  getRankedTerms() {
    return Array.from(this.graph.entries())
      .map(([word, node]) => ({ word, rank: node.rank || 0 }))
      .sort((a, b) => b.rank - a.rank);
  }

  get nodeCount() { return this.graph.size; }
}
