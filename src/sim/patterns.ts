export type Offset = readonly [dLat: number, dLon: number]

const LIVE_CHARS = new Set(['O', 'o', 'X', 'x', '#', '1', '@'])

export function parseAsciiPattern(ascii: string): Offset[] {
  const lines = ascii
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.replace(/\s+$/g, '')) // trim line end
    .filter(l => l.trim().length > 0)

  if (lines.length === 0) return []

  const height = lines.length
  const width = Math.max(...lines.map(l => l.length))
  const cy = (height - 1) / 2
  const cx = (width - 1) / 2

  const offsets: Offset[] = []
  for (let y = 0; y < height; y++) {
    const line = lines[y]
    for (let x = 0; x < line.length; x++) {
      if (!LIVE_CHARS.has(line[x])) continue
      const dLon = Math.round(x - cx)
      const dLat = Math.round(y - cy)
      offsets.push([dLat, dLon])
    }
  }
  return offsets
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
  `
}

export const BUILTIN_PATTERN_NAMES = Object.keys(BUILTIN_ASCII)

export function getBuiltinPatternOffsets(name: string): Offset[] {
  const ascii = BUILTIN_ASCII[name]
  return ascii ? parseAsciiPattern(ascii) : []
}
