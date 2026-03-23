export type Offset = readonly [dLat: number, dLon: number];

const LIVE_CHARS = new Set(['O', 'o', 'X', 'x', '#', '1', '@']);

export function parseAsciiPattern(ascii: string): Offset[] {
  let lines = ascii
    .replace(/\r/g, '')
    .split('\n')
    .filter((l) => l.trim().length > 0); // remove fully empty lines

  if (lines.length === 0) return [];

  // Dedent: find min leading whitespace
  let minIndent = Infinity;
  for (const line of lines) {
    const match = line.match(/^(\s*)/);
    if (match) {
      const indent = match[1].length;
      if (indent < minIndent) minIndent = indent;
    }
  }

  if (minIndent > 0 && minIndent !== Infinity) {
    lines = lines.map((l) => l.substring(minIndent));
  }

  // Right trim
  lines = lines.map((l) => l.replace(/\s+$/g, ''));

  const height = lines.length;
  const width = Math.max(...lines.map((l) => l.length));
  const cy = Math.floor(height / 2);
  const cx = Math.floor(width / 2);

  const offsets: Offset[] = [];
  for (let y = 0; y < height; y++) {
    const line = lines[y];
    for (let x = 0; x < line.length; x++) {
      if (!LIVE_CHARS.has(line[x])) continue;
      const dLon = x - cx;
      const dLat = y - cy;
      offsets.push([dLat, dLon]);
    }
  }
  return offsets;
}

/**
 * Transforms a list of relative offsets by scaling and applying jitter.
 */
export function transformOffsets(
  offsets: Offset[],
  scale: number,
  jitter: number,
  rng: () => number = Math.random,
): Offset[] {
  const s = Math.max(1, Math.floor(scale));
  const j = Math.max(0, Math.floor(jitter));

  return offsets.map(([dLa0, dLo0]) => {
    let dLa = dLa0 * s;
    let dLo = dLo0 * s;

    if (j > 0) {
      dLa += Math.floor((rng() * 2 - 1) * j);
      dLo += Math.floor((rng() * 2 - 1) * j);
    }

    return [dLa, dLo] as const;
  });
}

/**
 * Converts a list of relative offsets into a 2D matrix (number[][]).
 * The matrix will be as small as possible while containing all offsets.
 * The (0,0) offset will be at a specific [row, col] in the returned object.
 */
export function offsetsToMatrix(offsets: Offset[]): {
  matrix: number[][];
  originRow: number;
  originCol: number;
} {
  if (offsets.length === 0) {
    return { matrix: [], originRow: 0, originCol: 0 };
  }

  const lats = offsets.map((o) => o[0]);
  const lons = offsets.map((o) => o[1]);

  const minLat = Math.min(...lats, 0); // Include 0 to ensure we know where the origin is
  const maxLat = Math.max(...lats, 0);
  const minLon = Math.min(...lons, 0);
  const maxLon = Math.max(...lons, 0);

  const height = maxLat - minLat + 1;
  const width = maxLon - minLon + 1;

  const matrix: number[][] = Array.from({ length: height }, () => new Array<number>(width).fill(0));

  for (const [lat, lon] of offsets) {
    matrix[lat - minLat][lon - minLon] = 1;
  }

  return {
    matrix,
    originRow: -minLat,
    originCol: -minLon,
  };
}

// Built-ins as ASCII (easy to tweak / share)
const BUILTIN_ASCII: Record<string, string> = {
  Cross: `
    .O.
    OOO
    .O.
  `,
  Glider: `
    .O.
    ..O
    OOO
  `,
  Exploder: `
    O.O.O
    O...O
    O...O
    O...O
    O.O.O
  `,
  Ring: `
    .OOO.
    O...O
    O...O
    O...O
    .OOO.
  `,
  Solid: `
    OOO
    OOO
    OOO
  `,
  'R-pentomino': `
    .OO
    OO.
    .O.
  `,
  Diehard: `
    ......O.
    OO......
    .O...OOO
  `,
  Acorn: `
    .O.....
    ...O...
    OO..OOO
  `,
  LWSS: `
    .O..O
    O....
    O...O
    OOOO.
  `,
};

export const BUILTIN_PATTERN_NAMES = Object.keys(BUILTIN_ASCII);

export function getBuiltinPatternOffsets(name: string): Offset[] {
  const ascii = BUILTIN_ASCII[name];
  return ascii ? parseAsciiPattern(ascii) : [];
}
