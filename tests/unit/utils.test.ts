import { describe, expect, it } from 'vitest';

import { buildRandomDiskOffsets, clampInt, safeFloat, safeInt } from '../../src/sim/utils';

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

  describe('buildRandomDiskOffsets', () => {
    it('returns offsets in final cell units for the requested radius', () => {
      // Radius 1: center + 4 cardinal neighbors.
      const r1 = buildRandomDiskOffsets(1);
      expect(r1.length).toBe(5);
      expect(r1.every(([dy, dx]) => dy * dy + dx * dx <= 1)).toBe(true);
    });

    it('grows linearly with the radius (no quadratic re-scaling)', () => {
      const r3 = buildRandomDiskOffsets(3);
      expect(r3.length).toBeGreaterThan(buildRandomDiskOffsets(2).length);
      // Radius 3 disk: all offsets must lie within radius 3 of the center.
      expect(r3.every(([dy, dx]) => dy * dy + dx * dx <= 9)).toBe(true);
      // Center is included.
      expect(r3.some(([dy, dx]) => dy === 0 && dx === 0)).toBe(true);
    });

    it('clamps to a minimum radius of 1', () => {
      expect(buildRandomDiskOffsets(0).length).toBe(5);
      expect(buildRandomDiskOffsets(-3).length).toBe(5);
    });
  });
});
