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
});
