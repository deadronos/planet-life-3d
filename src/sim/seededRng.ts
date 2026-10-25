/**
 * Deterministic PRNG (mulberry32) so Randomize is reproducible from a uint32
 * world seed. CPU, worker and GPU init all draw from this same generator in
 * the same order (one draw per cell, plus one more for live Colony cells), so
 * a seed yields the identical initial pattern on every path.
 */
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fresh random uint32 seed. */
export function newWorldSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

/** Coerce to uint32; returns undefined for anything that is not a non-negative integer in range. */
export function parseWorldSeed(value: unknown): number | undefined {
  const n = typeof value === 'string' && /^\d{1,10}$/.test(value) ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 4294967295 ? n : undefined;
}
