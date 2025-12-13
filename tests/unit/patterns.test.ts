import { describe, it, expect } from 'vitest';
import {
  parseAsciiPattern,
  getBuiltinPatternOffsets,
  BUILTIN_PATTERN_NAMES,
} from '../../src/sim/patterns';

describe('patterns', () => {
  describe('parseAsciiPattern', () => {
    it('should return empty offsets for empty string', () => {
      expect(parseAsciiPattern('')).toEqual([]);
    });

    it('should return empty offsets for string with no live chars', () => {
      expect(parseAsciiPattern('...\n...')).toEqual([]);
    });

    it('should parse simple single point', () => {
      // 1x1, centered at 0,0
      expect(parseAsciiPattern('O')).toEqual([[0, 0]]);
    });

    it('should parse line of 3 (blinker)', () => {
      // 3x1
      // OOO
      // cx = 1, cy = 0
      // x=0, y=0 -> dLon=-1, dLat=0
      // x=1, y=0 -> dLon=0, dLat=0
      // x=2, y=0 -> dLon=1, dLat=0
      const offsets = parseAsciiPattern('OOO');
      expect(offsets).toHaveLength(3);
      expect(offsets).toContainEqual([0, -1]);
      expect(offsets).toContainEqual([0, 0]);
      expect(offsets).toContainEqual([0, 1]);
    });

    it('should ignore dead characters', () => {
      const offsets = parseAsciiPattern('.O.');
      expect(offsets).toHaveLength(1);
      expect(offsets[0]).toEqual([0, 0]);
    });

    it('should handle multiple lines', () => {
      // 3x3
      // .O.
      // OOO
      // .O.
      // cx=1, cy=1
      // (0,1) -> [ -1, 0 ] -> wait, y=0, x=1. dLat = 0-1 = -1. dLon = 1-1 = 0.
      // (1,0) -> [ 0, -1 ]
      // (1,1) -> [ 0, 0 ]
      // (1,2) -> [ 0, 1 ]
      // (2,1) -> [ 1, 0 ]
      const pattern = `
        .O.
        OOO
        .O.
      `;
      const offsets = parseAsciiPattern(pattern);
      expect(offsets).toHaveLength(5);
      expect(offsets).toContainEqual([-1, 0]);
      expect(offsets).toContainEqual([0, -1]);
      expect(offsets).toContainEqual([0, 0]);
      expect(offsets).toContainEqual([0, 1]);
      expect(offsets).toContainEqual([1, 0]);
    });

    it('should handle different live characters', () => {
      expect(parseAsciiPattern('x')).toEqual([[0, 0]]);
      expect(parseAsciiPattern('#')).toEqual([[0, 0]]);
      expect(parseAsciiPattern('@')).toEqual([[0, 0]]);
      expect(parseAsciiPattern('1')).toEqual([[0, 0]]);
    });
  });

  describe('getBuiltinPatternOffsets', () => {
    it('should return offsets for known patterns', () => {
      for (const name of BUILTIN_PATTERN_NAMES) {
        const offsets = getBuiltinPatternOffsets(name);
        expect(offsets.length).toBeGreaterThan(0);
      }
    });

    it('should return empty array for unknown pattern', () => {
      expect(getBuiltinPatternOffsets('UnknownPattern')).toEqual([]);
    });

    it('should return specific known shape (Glider)', () => {
      const glider = getBuiltinPatternOffsets('Glider');
      // .O.
      // ..O
      // OOO
      // 3x3. cx=1, cy=1
      // (0,1) -> [-1, 0]
      // (1,2) -> [0, 1]
      // (2,0) -> [1, -1]
      // (2,1) -> [1, 0]
      // (2,2) -> [1, 1]
      expect(glider).toHaveLength(5);
      expect(glider).toContainEqual([-1, 0]);
      expect(glider).toContainEqual([0, 1]);
      expect(glider).toContainEqual([1, -1]);
      expect(glider).toContainEqual([1, 0]);
      expect(glider).toContainEqual([1, 1]);
    });
  });
});
