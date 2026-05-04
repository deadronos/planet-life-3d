import { describe, expect, it } from 'vitest';

import {
  BUILTIN_PATTERN_NAMES,
  getBuiltinPatternOffsets,
  offsetsToMatrix,
  parseAsciiPattern,
  transformOffsets,
} from '../../src/sim/patterns';

describe('patterns utility', () => {
  it('returns empty offsets for empty or dead-only patterns', () => {
    expect(parseAsciiPattern('')).toEqual([]);
    expect(parseAsciiPattern('...\n...')).toEqual([]);
  });

  it('parses ASCII patterns and centers them correctly', () => {
    const ascii = `
      .O.
      OOO
      .O.
    `;
    const offsets = parseAsciiPattern(ascii);
    // 3x3 pattern, center is floor(3/2) = 1, 1
    // .O. (0,1) -> (0-1, 1-1) = (-1, 0)
    // OOO (1,0)(1,1)(1,2) -> (0, -1)(0, 0)(0, 1)
    // .O. (2,1) -> (1, 0)
    expect(offsets).toContainEqual([-1, 0]);
    expect(offsets).toContainEqual([0, -1]);
    expect(offsets).toContainEqual([0, 0]);
    expect(offsets).toContainEqual([0, 1]);
    expect(offsets).toContainEqual([1, 0]);
    expect(offsets.length).toBe(5);
  });

  it('parses built-in patterns by name', () => {
    expect(BUILTIN_PATTERN_NAMES).toContain('Glider');
    expect(getBuiltinPatternOffsets('Glider')).toHaveLength(5);
  });

  it('handles even-dimension pattern centering', () => {
    const ascii = `
      OO
      OO
    `;
    const offsets = parseAsciiPattern(ascii);
    // 2x2 pattern, center is floor(2/2) = 1, 1
    // OO (0,0)(0,1) -> (-1, -1)(-1, 0)
    // OO (1,0)(1,1) -> (0, -1)(0, 0)
    expect(offsets).toContainEqual([-1, -1]);
    expect(offsets).toContainEqual([-1, 0]);
    expect(offsets).toContainEqual([0, -1]);
    expect(offsets).toContainEqual([0, 0]);
  });

  it('transforms offsets correctly', () => {
    const offsets: Array<readonly [number, number]> = [[1, 1]];
    const transformed = transformOffsets(offsets, 2, 0);
    expect(transformed).toEqual([[2, 2]]);
  });

  it('applies deterministic jitter when provided with an rng', () => {
    const offsets: Array<readonly [number, number]> = [[1, 1]];
    const transformed = transformOffsets(offsets, 1, 2, () => 1);
    expect(transformed).toEqual([[3, 3]]);
  });

  it('converts offsets to matrix with origin tracking', () => {
    const offsets: Array<readonly [number, number]> = [
      [-1, 0],
      [0, 0],
      [1, 0],
    ];
    const { matrix, originRow, originCol } = offsetsToMatrix(offsets);

    // Min lat is -1, Max is 1 -> height 3
    // Min lon is 0, Max is 0 -> width 1
    expect(matrix.length).toBe(3);
    expect(matrix[0].length).toBe(1);

    // Origin is at row 1, col 0
    expect(originRow).toEqual(1);
    // Use closeTo or just add 0 to avoid -0
    expect(originCol + 0).toEqual(0);

    expect(matrix[0][0]).toBe(1); // -1
    expect(matrix[1][0]).toBe(1); // 0
    expect(matrix[2][0]).toBe(1); // 1
  });

  describe('parseAsciiPattern', () => {
    it('empty string returns empty array', () => {
      expect(parseAsciiPattern('')).toEqual([]);
    });

    it('single cell pattern', () => {
      const offsets = parseAsciiPattern('O');
      expect(offsets).toContainEqual([0, 0]);
      expect(offsets.length).toBe(1);
    });

    it('pattern with indentation is dedented', () => {
      const ascii = `
        .O.
        OOO
        .O.
      `;
      const offsets = parseAsciiPattern(ascii);
      // Should parse same as non-indented version
      expect(offsets).toContainEqual([-1, 0]);
      expect(offsets).toContainEqual([0, -1]);
      expect(offsets).toContainEqual([0, 0]);
      expect(offsets).toContainEqual([0, 1]);
      expect(offsets).toContainEqual([1, 0]);
    });

    it('pattern centering puts (0,0) at center', () => {
      // 3x3 pattern, center is at floor(3/2)=1,1
      const ascii = `
        .O.
        OOO
        .O.
      `;
      const offsets = parseAsciiPattern(ascii);
      // (0,0) should be one of the offsets
      expect(offsets).toContainEqual([0, 0]);
    });

    it('mixed live chars all treated as live', () => {
      // All these chars should be treated as live cells
      const ascii = 'OXox#1@';
      const offsets = parseAsciiPattern(ascii);
      expect(offsets.length).toBe(7);
    });

    it('empty lines are filtered out', () => {
      const ascii = `
        O

        O
      `;
      const offsets = parseAsciiPattern(ascii);
      expect(offsets.length).toBe(2);
    });

    it('right trimming works', () => {
      const ascii = 'OO   ';
      const offsets = parseAsciiPattern(ascii);
      expect(offsets.length).toBe(2);
    });
  });

  describe('offsetsToMatrix', () => {
    it('empty offsets returns empty matrix with origin at (0,0)', () => {
      const result = offsetsToMatrix([]);
      expect(result.matrix).toEqual([]);
      expect(result.originRow).toEqual(0);
      expect(result.originCol).toEqual(0);
    });

    it('single offset places it at origin', () => {
      const offsets: Array<readonly [number, number]> = [[0, 0]];
      const { matrix, originRow, originCol } = offsetsToMatrix(offsets);

      expect(matrix.length).toBe(1);
      expect(matrix[0].length).toBe(1);
      expect(matrix[0][0]).toBe(1);
      expect(originRow + 0).toEqual(0);
      expect(originCol + 0).toEqual(0);
    });

    it('multiple offsets produce correct dimensions', () => {
      // 3 cells in a line: [-1,0], [0,0], [1,0]
      const offsets: Array<readonly [number, number]> = [
        [-1, 0],
        [0, 0],
        [1, 0],
      ];
      const { matrix, originRow, originCol } = offsetsToMatrix(offsets);

      expect(matrix.length).toBe(3);
      expect(matrix[0].length).toBe(1);
      expect(originRow).toEqual(1);
      expect(originCol + 0).toEqual(0);
      expect(matrix[1][0]).toBe(1); // origin
    });

    it('offsets spanning negative and positive lat/lon', () => {
      const offsets: Array<readonly [number, number]> = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ];
      const { matrix, originRow, originCol } = offsetsToMatrix(offsets);

      // minLat=-1, maxLat=1 -> height 3
      // minLon=-1, maxLon=1 -> width 3
      expect(matrix.length).toBe(3);
      expect(matrix[0].length).toBe(3);

      // Origin should be at row 1, col 1
      expect(originRow).toEqual(1);
      expect(originCol).toEqual(1);

      // Corner cells
      expect(matrix[0][0]).toBe(1); // [-1,-1]
      expect(matrix[0][2]).toBe(1); // [-1,1]
      expect(matrix[2][0]).toBe(1); // [1,-1]
      expect(matrix[2][2]).toBe(1); // [1,1]
    });
  });
});
