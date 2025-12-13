import { describe, it, expect } from 'vitest';
import { parseAsciiPattern } from '../src/sim/patterns';

describe('parseAsciiPattern', () => {
  it('parses a simple glider pattern', () => {
    const ascii = `.O.\n..O\nOOO`;
    const offsets = parseAsciiPattern(ascii);
    const expected = [
      [-1, 0],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];

    expect(offsets).toHaveLength(expected.length);

    const s = offsets.map(([a, b]) => `${a},${b}`).sort();
    const e = expected.map(([a, b]) => `${a},${b}`).sort();
    expect(s).toEqual(e);
  });

  it('returns empty offsets for empty input', () => {
    expect(parseAsciiPattern('\n   \n')).toEqual([]);
  });
});
