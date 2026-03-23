import { describe, expect, it } from 'vitest';
import { offsetsToMatrix, parseAsciiPattern, transformOffsets } from '../../src/sim/patterns';

describe('patterns utility', () => {
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
});
