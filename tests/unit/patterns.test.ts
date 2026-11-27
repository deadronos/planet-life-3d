import { describe, expect, it } from 'vitest';

import {
  BUILTIN_PATTERN_NAMES,
  getBuiltinPatternOffsets,
  isRlePattern,
  normalizeSeedRotation,
  offsetsToMatrix,
  parseAsciiPattern,
  parsePattern,
  parseRlePattern,
  rotateOffsets,
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

  describe('LifeWiki RLE parsing', () => {
    const sortOffsets = (offsets: ReadonlyArray<readonly [number, number]>) =>
      offsets.map(([a, b]) => `${a},${b}`).sort();

    it('parses a LifeWiki Glider RLE matching the built-in Glider offsets', () => {
      const gliderRle = [
        '#N Glider',
        '#O Richard K. Guy',
        '#C The smallest, most common, and first discovered spaceship.',
        'x = 3, y = 3, rule = B3/S23',
        'bo$2bo$3o!',
      ].join('\n');

      expect(isRlePattern(gliderRle)).toBe(true);
      const parsed = parsePattern(gliderRle);
      expect(sortOffsets(parsed)).toEqual(sortOffsets(getBuiltinPatternOffsets('Glider')));
      // Backward-compatible entry point also auto-detects RLE.
      expect(sortOffsets(parseAsciiPattern(gliderRle))).toEqual(
        sortOffsets(getBuiltinPatternOffsets('Glider')),
      );
    });

    it('parses the multi-line Gosper Glider Gun RLE cleanly', () => {
      const gunRle = [
        '#N Gosper glider gun',
        '#O Bill Gosper',
        '#C A true period 30 glider gun.',
        'x = 36, y = 9, rule = B3/S23',
        '24bo11b$22bobo11b$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o14b$2o8b',
        'o3bob2o4bobo11b$10bo5bo7bo11b$11bo3bo20b$12b2o!',
      ].join('\n');

      expect(isRlePattern(gunRle)).toBe(true);
      const parsed = parsePattern(gunRle);
      // Gosper glider gun has exactly 36 live cells across a 36x9 bounding box (cx=18, cy=4).
      expect(parsed).toHaveLength(36);
      const lats = parsed.map(([lat]) => lat);
      const lons = parsed.map(([, lon]) => lon);
      expect(Math.min(...lats)).toBe(-4);
      expect(Math.max(...lats)).toBe(4);
      expect(Math.min(...lons)).toBe(-18);
      expect(Math.max(...lons)).toBe(17);
    });

    it('handles headerless RLE, multi-row $ counts, uppercase B/O, and missing or trailing !', () => {
      expect(sortOffsets(parsePattern('bo$2bo$3o!'))).toEqual(
        sortOffsets(getBuiltinPatternOffsets('Glider')),
      );
      expect(sortOffsets(parsePattern('x = 3, y = 3\nBO$2BO$3O'))).toEqual(
        sortOffsets(getBuiltinPatternOffsets('Glider')),
      );
      expect(parsePattern('bo$2bo$3o! ignored trailing cells ooo')).toHaveLength(5);

      const skippedRows = parsePattern('x = 1, y = 4\no3$o!');
      expect(skippedRows).toEqual([
        [-2, 0],
        [1, 0],
      ]);
    });

    it('keeps ASCII patterns with # and o backward compatible', () => {
      const hashCross = '.#.\n###\n.#.';
      expect(isRlePattern(hashCross)).toBe(false);
      expect(parseAsciiPattern(hashCross)).toHaveLength(5);

      const lowercaseOs = 'ooo\no.o\nooo';
      expect(isRlePattern(lowercaseOs)).toBe(false);
      expect(parseAsciiPattern(lowercaseOs)).toHaveLength(8);
    });

    it('degrades gracefully on malformed or oversized RLE inputs', () => {
      expect(parseRlePattern('')).toEqual([]);
      expect(parsePattern('#N Empty\n#C No cells')).toEqual([]);
      expect(parsePattern('x = 0, y = 0\n!')).toEqual([]);
      expect(parsePattern('x = -3, y = 3\nbo$2bo$3o!')).toEqual([]);
      expect(parsePattern('x = 3, y = 3\n')).toEqual([]);
      expect(parsePattern('x = 3, y = 3\n???invalid_xyz???')).toEqual([]);
      expect(parsePattern('x = 3, y = 3\nbo$2zbo$3o!')).toHaveLength(5);
      expect(parsePattern('bo$2bo$3!')).toHaveLength(2);

      const hugeCells = parsePattern('x = 1000000, y = 1000000\n999999999o!');
      expect(hugeCells.length).toBeGreaterThan(0);
      expect(hugeCells.length).toBeLessThanOrEqual(1024);

      expect(parsePattern('x = 3, y = 3\n999999999$o!')).toEqual([]);
      expect(parsePattern('x = 3, y = 3\n999999999b2o!')).toEqual([]);
    });
  });

  describe('rotateOffsets and normalizeSeedRotation', () => {
    it('normalizes arbitrary angles to 0/90/180/270', () => {
      expect(normalizeSeedRotation(0)).toBe(0);
      expect(normalizeSeedRotation(90)).toBe(90);
      expect(normalizeSeedRotation(-90)).toBe(270);
      expect(normalizeSeedRotation(450)).toBe(90);
      expect(normalizeSeedRotation(Number.NaN)).toBe(0);
    });

    it('rotates a single offset clockwise in 90-degree steps without producing -0', () => {
      const pts: Array<readonly [number, number]> = [
        [1, 2],
        [0, 1],
      ];
      const r90 = rotateOffsets(pts, 90);
      const r180 = rotateOffsets(pts, 180);
      const r270 = rotateOffsets(pts, 270);
      const r360 = rotateOffsets(r270, 90);

      expect(r90).toEqual([
        [2, -1],
        [1, 0],
      ]);
      expect(r180).toEqual([
        [-1, -2],
        [0, -1],
      ]);
      expect(r270).toEqual([
        [-2, 1],
        [-1, 0],
      ]);
      expect(r360).toEqual(pts);

      for (const [dLat, dLon] of [...r90, ...r180, ...r270]) {
        expect(Object.is(dLat, -0)).toBe(false);
        expect(Object.is(dLon, -0)).toBe(false);
      }
    });

    it('rotates asymmetric patterns consistently through four 90-degree turns', () => {
      const glider = getBuiltinPatternOffsets('Glider');
      const once = rotateOffsets(glider, 90);
      const twice = rotateOffsets(once, 90);
      const thrice = rotateOffsets(twice, 90);
      const fourTimes = rotateOffsets(thrice, 90);

      expect(twice).toEqual(rotateOffsets(glider, 180));
      expect(thrice).toEqual(rotateOffsets(glider, 270));
      expect(fourTimes).toEqual(glider);
      expect(once).not.toEqual(glider);
    });
  });
});
