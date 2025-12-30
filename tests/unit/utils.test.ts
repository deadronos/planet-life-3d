import { describe, it, expect } from 'vitest';
import { clampInt, safeInt, safeFloat } from '../../src/sim/utils';

describe('utils', () => {
  describe('clampInt', () => {
    it('clamps below range to lo', () => expect(clampInt(-5, 0, 10)).toBe(0));
    it('clamps above range to hi', () => expect(clampInt(12, 0, 10)).toBe(10));
    it('keeps values in range', () => expect(clampInt(5, 0, 10)).toBe(5));
  });

  describe('safeInt', () => {
    it('handles non-numeric input by returning fallback', () =>
      expect(safeInt('not-number', 7, 0, 10)).toBe(7));
    it('floors and clamps numeric inputs', () => expect(safeInt(9.9, 0, 0, 10)).toBe(9));
    it('clamps negatives', () => expect(safeInt(-5, 0, 0, 10)).toBe(0));
  });

  describe('safeFloat', () => {
    it('handles invalid input by returning fallback', () =>
      expect(safeFloat('x', 1.23, 0, 10)).toBe(1.23));
    it('clamps to range', () => expect(safeFloat(20, 0, 0, 10)).toBe(10));
    it('returns value when valid', () => expect(safeFloat(2.5, 0, 0, 10)).toBe(2.5));
  });
});
