import { describe, it, expect } from 'vitest';
import { SemanticEngine } from './nlp';
import { AppConfig } from '../types';

describe('SemanticEngine', () => {
  const defaultConfig: AppConfig = {
    nlpLevel: 'standard',
    dampingFactor: 0.85,
    clusteringSensitivity: 5,
    blacklist: new Set(['the', 'and', 'to', 'of', 'a', 'in', 'is', 'that', 'for', 'it', 'as', 'was', 'with', 'be', 'by', 'on', 'not', 'he', 'i', 'are', 'or', 'his', 'from', 'at', 'which', 'but', 'have', 'an', 'had', 'they', 'you', 'were', 'their', 'one', 'all', 'we', 'can', 'her', 'has', 'there', 'been', 'if', 'more', 'when', 'will', 'would', 'who', 'so', 'no'])
  };

  describe('tokenize', () => {
    it('should convert text to lowercase and split by spaces', () => {
      const engine = new SemanticEngine(defaultConfig);
      const tokens = engine.tokenize('Hello World THIS is A Test');
      expect(tokens).toEqual(['hello', 'world', 'this', 'test']);
    });

    it('should replace non-alphabetical characters with spaces', () => {
      const engine = new SemanticEngine(defaultConfig);
      const tokens = engine.tokenize('Hello, world! It\'s 100% fine. How-about_this?');
      expect(tokens).toEqual(['hello', 'world', 'fine', 'how', 'about', 'this']);
    });

    it('should remove words with 2 or fewer characters', () => {
      const engine = new SemanticEngine(defaultConfig);
      const tokens = engine.tokenize('A ab abc abcd abcde');
      expect(tokens).toEqual(['abc', 'abcd', 'abcde']);
    });

    it('should remove blacklisted words', () => {
      const config = { ...defaultConfig, blacklist: new Set(['apple', 'banana']) };
      const engine = new SemanticEngine(config);
      const tokens = engine.tokenize('I like apple and banana but also orange');
      expect(tokens).toEqual(['like', 'and', 'but', 'also', 'orange']);
    });

    it('should handle empty strings and strings with only spaces', () => {
      const engine = new SemanticEngine(defaultConfig);
      expect(engine.tokenize('')).toEqual([]);
      expect(engine.tokenize('   ')).toEqual([]);
      expect(engine.tokenize(' \t \n ')).toEqual([]);
    });

    it('should handle strings with only symbols or numbers', () => {
      const engine = new SemanticEngine(defaultConfig);
      expect(engine.tokenize('123 456 789')).toEqual([]);
      expect(engine.tokenize('!@# $%^ &*()')).toEqual([]);
      expect(engine.tokenize('123!@#')).toEqual([]);
    });
  });

  describe('processNLP', () => {
    it('should handle an empty graph gracefully for fragmentary level', () => {
      const config = { ...defaultConfig, nlpLevel: 'fragmentary' as const };
      const engine = new SemanticEngine(config);
      expect(() => engine.processNLP()).not.toThrow();
    });

    it('should handle an empty graph gracefully for standard level', () => {
      const config = { ...defaultConfig, nlpLevel: 'standard' as const };
      const engine = new SemanticEngine(config);
      expect(() => engine.processNLP()).not.toThrow();
    });

    it('should handle an empty graph gracefully for dense level', () => {
      const config = { ...defaultConfig, nlpLevel: 'dense' as const };
      const engine = new SemanticEngine(config);
      expect(() => engine.processNLP()).not.toThrow();
  describe('addText', () => {
    it('should return early if text has no tokens', () => {
      const engine = new SemanticEngine(defaultConfig);
      engine.addText('a ab');
      expect(engine.totalDocs).toBe(0);
      expect(engine.graph.size).toBe(0);
    });

    it('should increment totalDocs and populate graph node frequency', () => {
      const engine = new SemanticEngine(defaultConfig);
      engine.addText('hello world hello');
      expect(engine.totalDocs).toBe(1);
      expect(engine.graph.size).toBe(2);
      expect(engine.graph.get('hello')?.frequency).toBe(2);
      expect(engine.graph.get('world')?.frequency).toBe(1);
    });

    it('should correctly populate node neighbors based on windowSize', () => {
      const engine = new SemanticEngine(defaultConfig);
      engine.addText('first second third fourth fifth');

      const nodeOne = engine.graph.get('first');
      expect(nodeOne).toBeDefined();
      expect(nodeOne?.neighbors.has('second')).toBe(true);
      expect(nodeOne?.neighbors.has('third')).toBe(true);
      // distance from 'one' to 'two' is 1, weight is 1/1 = 1
      expect(nodeOne?.neighbors.get('second')).toBe(1);
      // distance from 'one' to 'three' is 2, weight is 1/2 = 0.5
      expect(nodeOne?.neighbors.get('third')).toBe(0.5);
    });

    it('should cumulatively update totalDocs and node frequency for multiple texts', () => {
      const engine = new SemanticEngine(defaultConfig);
      engine.addText('hello world');
      engine.addText('hello again');
      expect(engine.totalDocs).toBe(2);
      expect(engine.graph.size).toBe(3);
      expect(engine.graph.get('hello')?.frequency).toBe(2);
      expect(engine.graph.get('world')?.frequency).toBe(1);
      expect(engine.graph.get('again')?.frequency).toBe(1);
    });
  });
});
