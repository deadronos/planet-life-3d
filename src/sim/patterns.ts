export type Offset = readonly [dLat: number, dLon: number];
export type SeedRotation = 0 | 90 | 180 | 270;

const LIVE_CHARS = new Set(['O', 'o', 'X', 'x', '#', '1', '@']);
const MAX_RLE_DIM = 1024;
const MAX_RLE_CELLS = 16384;
const RLE_HEADER_RE = /^\s*x\s*=\s*(-?\d+)\s*,\s*y\s*=\s*(-?\d+)(?:\s*,\s*rule\s*=.*)?$/i;
const RLE_COMMENT_TAG_RE = /^#[CNOPRcnopr](?:\s|$)/;
const RLE_BODY_ONLY_RE = /^[0-9boBO$.!\s]+$/;

/**
 * Normalize an arbitrary angle in degrees to a valid 90-degree step (0/90/180/270).
 */
export function normalizeSeedRotation(degrees: number): SeedRotation {
  if (!Number.isFinite(degrees)) return 0;
  const snapped = (((Math.round(degrees / 90) * 90) % 360) + 360) % 360;
  return snapped === 90 || snapped === 180 || snapped === 270 ? snapped : 0;
}

/**
 * Rotate relative `[dLat, dLon]` offsets clockwise in 90-degree increments.
 */
export function rotateOffsets(offsets: Offset[], rotation: number): Offset[] {
  const step = normalizeSeedRotation(rotation);
  if (step === 0) {
    return offsets.map(([dLat, dLon]) => [dLat || 0, dLon || 0] as const);
  }
  if (step === 90) {
    return offsets.map(([dLat, dLon]) => [dLon || 0, -dLat || 0] as const);
  }
  if (step === 180) {
    return offsets.map(([dLat, dLon]) => [-dLat || 0, -dLon || 0] as const);
  }
  return offsets.map(([dLat, dLon]) => [-dLon || 0, dLat || 0] as const);
}

/**
 * Detect whether a pattern string uses LifeWiki RLE syntax rather than plain ASCII art.
 */
export function isRlePattern(input: string): boolean {
  const lines = input.replace(/\r/g, '').split('\n');
  let sawRleComment = false;
  const nonCommentLines: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (RLE_HEADER_RE.test(trimmed)) return true;
    if (trimmed.startsWith('#')) {
      if (RLE_COMMENT_TAG_RE.test(trimmed)) {
        sawRleComment = true;
        continue;
      }
      if (sawRleComment) continue;
    }
    nonCommentLines.push(trimmed);
  }

  if (nonCommentLines.length === 0) {
    return sawRleComment;
  }

  const joined = nonCommentLines.join('\n');
  const bangIdx = joined.indexOf('!');
  const candidate = bangIdx >= 0 ? joined.slice(0, bangIdx + 1) : joined;
  return (candidate.includes('$') || candidate.includes('!')) && RLE_BODY_ONLY_RE.test(candidate);
}

/**
 * Parse a LifeWiki Run-Length Encoded (RLE) pattern into centered `[dLat, dLon]` offsets.
 * Handles `#` metadata/comment lines, `x = ..., y = ...` headers, run counts, `b`/`o`/`$`/`!`,
 * and degrades gracefully on malformed or oversized inputs.
 */
export function parseRlePattern(rle: string): Offset[] {
  const lines = rle.replace(/\r/g, '').split('\n');
  let headerWidth = 0;
  let headerHeight = 0;
  let hasHeader = false;
  const bodyLines: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!hasHeader) {
      const headerMatch = trimmed.match(RLE_HEADER_RE);
      if (headerMatch) {
        headerWidth = Number.parseInt(headerMatch[1], 10);
        headerHeight = Number.parseInt(headerMatch[2], 10);
        if (!Number.isFinite(headerWidth) || !Number.isFinite(headerHeight)) return [];
        if (headerWidth <= 0 || headerHeight <= 0) return [];
        hasHeader = true;
        continue;
      }
    }
    bodyLines.push(trimmed);
  }

  const body = bodyLines.join('');
  if (!body) return [];

  const cells: Array<readonly [y: number, x: number]> = [];
  let x = 0;
  let y = 0;
  let maxX = -1;
  let maxY = -1;
  let countDigits = '';

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch >= '0' && ch <= '9') {
      // Cap accumulated digits so absurd run counts never overflow or hang.
      if (countDigits.length < 6) {
        countDigits += ch;
      }
      continue;
    }
    if (/\s/.test(ch)) continue;
    if (ch === '!') break;

    const rawCount = countDigits.length > 0 ? Number.parseInt(countDigits, 10) : 1;
    countDigits = '';
    const count = Math.min(Math.max(0, rawCount), MAX_RLE_DIM);

    if (ch === '$') {
      if (count > 0) {
        y = Math.min(y + count, MAX_RLE_DIM);
        x = 0;
      }
    } else if (ch === 'b' || ch === 'B' || ch === '.') {
      x = Math.min(x + count, MAX_RLE_DIM);
    } else if (ch === 'o' || ch === 'O') {
      for (let k = 0; k < count; k++) {
        if (x >= MAX_RLE_DIM || y >= MAX_RLE_DIM || cells.length >= MAX_RLE_CELLS) break;
        cells.push([y, x] as const);
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        x++;
      }
      if (cells.length >= MAX_RLE_CELLS) break;
    } else {
      countDigits = '';
    }
  }

  if (cells.length === 0) return [];

  const boundedHeaderW = hasHeader && headerWidth <= MAX_RLE_DIM ? headerWidth : 0;
  const boundedHeaderH = hasHeader && headerHeight <= MAX_RLE_DIM ? headerHeight : 0;
  const width = Math.max(boundedHeaderW, maxX + 1);
  const height = Math.max(boundedHeaderH, maxY + 1);
  const cy = Math.floor(height / 2);
  const cx = Math.floor(width / 2);

  return cells.map(([cellY, cellX]) => [cellY - cy || 0, cellX - cx || 0] as const);
}

/**
 * Parse either ASCII art or LifeWiki RLE pattern strings into centered `[dLat, dLon]` offsets.
 */
export function parsePattern(input: string): Offset[] {
  if (isRlePattern(input)) {
    return parseRlePattern(input);
  }
  return parseAsciiOnly(input);
}

export function parseAsciiPattern(ascii: string): Offset[] {
  return parsePattern(ascii);
}

function parseAsciiOnly(ascii: string): Offset[] {
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

// Cache for builtin patterns (pure/deterministic, safe to memoize)
const builtinCache: Record<string, Offset[]> = {};

export function getBuiltinPatternOffsets(name: string): Offset[] {
  if (!builtinCache[name]) {
    builtinCache[name] = parseAsciiPattern(BUILTIN_ASCII[name] || '');
  }
  return builtinCache[name];
}
