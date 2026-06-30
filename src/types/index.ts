export type NLPLevel = 'fragmentary' | 'standard' | 'dense';

export interface Node {
  frequency: number;
  neighbors: Map<string, number>;
  idf: number;
  rank?: number;
  hitsHub?: number;
  hitsAuthority?: number;
}

export interface Reading {
  castNumber: number;
  date: Date;
  sign: string;
  body: string[];
  thread: string;
  seal: string;
  ranked: { word: string; rank: number }[];
  clusters: string[][];
  termCount: number;
  clusterCount: number;
  axis: string;
}

export interface AppConfig {
  nlpLevel: NLPLevel;
  dampingFactor: number;
  clusteringSensitivity: number;
  blacklist: Set<string>;
}
