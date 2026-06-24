import { describe, expect, it } from 'vitest';

import { PatternTextureCache } from '../../src/components/patternTextureCache';

describe('PatternTextureCache', () => {
  it('returns the same texture for identical pattern content', () => {
    const cache = new PatternTextureCache();
    try {
      const a = cache.getOrCreate([
        [1, 0],
        [0, 1],
      ]);
      const b = cache.getOrCreate([
        [1, 0],
        [0, 1],
      ]);
      expect(b).toBe(a);
      expect(cache.size).toBe(1);
    } finally {
      cache.dispose();
    }
  });

  it('returns a different texture for different content', () => {
    const cache = new PatternTextureCache();
    try {
      const a = cache.getOrCreate([
        [1, 0],
        [0, 1],
      ]);
      const b = cache.getOrCreate([
        [0, 1],
        [1, 0],
      ]);
      expect(b).not.toBe(a);
      expect(cache.size).toBe(2);
    } finally {
      cache.dispose();
    }
  });

  it('treats patterns with different dimensions as distinct', () => {
    const cache = new PatternTextureCache();
    try {
      cache.getOrCreate([[1, 0]]);
      cache.getOrCreate([[1], [0]]);
      expect(cache.size).toBe(2);
    } finally {
      cache.dispose();
    }
  });

  it('handles an empty pattern without throwing', () => {
    const cache = new PatternTextureCache();
    try {
      const tex = cache.getOrCreate([]);
      expect(tex).toBeDefined();
      expect(cache.size).toBe(1);
    } finally {
      cache.dispose();
    }
  });

  it('evicts oldest entries once the cache is full (LRU-ish)', () => {
    const cache = new PatternTextureCache(2);
    try {
      const a = cache.getOrCreate([[1]]);
      const b = cache.getOrCreate([[0]]);
      // Touch a so b is the oldest.
      cache.getOrCreate([[1]]);
      // Adding c should evict b.
      cache.getOrCreate([[1, 1]]);
      expect(cache.size).toBe(2);
      // b is gone; asking again allocates a new texture.
      const b2 = cache.getOrCreate([[0]]);
      expect(b2).not.toBe(b);
      expect(a).toBeDefined();
    } finally {
      cache.dispose();
    }
  });

  it('dispose() clears the cache', () => {
    const cache = new PatternTextureCache();
    cache.getOrCreate([[1]]);
    cache.getOrCreate([[0]]);
    expect(cache.size).toBe(2);
    cache.dispose();
    expect(cache.size).toBe(0);
  });
});
