import * as THREE from 'three';

/**
 * Cache for GPU pattern `DataTexture`s used by `GPUSimulation.seedAtUV`.
 *
 * Each meteor impact used to allocate a fresh `Float32Array` + `THREE.DataTexture`,
 * push it to the GPU, and immediately `dispose()` it. With high meteor
 * rates (meteor shower on, frequent clicks) this churned the GC and
 * repeatedly uploaded the same pattern data to the GPU.
 *
 * The cache keys on the textual content of the pattern matrix, so:
 *   - Built-in patterns (returned from a module-level cache) hit the cache
 *     trivially across all impacts.
 *   - Custom ASCII patterns hit the cache as long as the user hasn't edited
 *     the textarea since the last impact.
 *   - Random disk patterns never hit the cache (they're regenerated every
 *     impact and that's what the user wants).
 *
 * The cache is bounded by an LRU-ish size limit so a long-running session
 * can't leak textures for every distinct ad-hoc pattern the user pastes
 * into the ASCII field.
 */
export class PatternTextureCache {
  private readonly map = new Map<string, { tex: THREE.DataTexture; data: Float32Array }>();
  private readonly maxEntries: number;

  constructor(maxEntries = 32) {
    this.maxEntries = maxEntries;
  }

  /**
   * Look up (or build) the pattern texture for a 2D matrix of 0/1 cells.
   *
   * The returned texture is owned by the cache; do not dispose it. Callers
   * should treat it as read-only.
   */
  getOrCreate(pattern: number[][]): THREE.DataTexture {
    const key = patternKey(pattern);
    const cached = this.map.get(key);
    if (cached) {
      // Refresh recency by re-inserting.
      this.map.delete(key);
      this.map.set(key, cached);
      return cached.tex;
    }

    const patternHeight = pattern.length;
    const patternWidth = patternHeight > 0 ? pattern[0].length : 0;
    const data = new Float32Array(patternWidth * patternHeight * 4);
    for (let y = 0; y < patternHeight; y++) {
      const row = pattern[y];
      for (let x = 0; x < patternWidth; x++) {
        const idx = (y * patternWidth + x) * 4;
        const value = row[x] > 0 ? 1.0 : 0.0;
        data[idx] = value;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 1;
      }
    }

    const tex = new THREE.DataTexture(
      data,
      patternWidth,
      patternHeight,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    tex.needsUpdate = true;

    this.map.set(key, { tex, data });
    this.evictIfNeeded();
    return tex;
  }

  /**
   * Free all GPU resources. Call from the owning component's unmount effect.
   */
  dispose() {
    for (const { tex } of this.map.values()) {
      tex.dispose();
    }
    this.map.clear();
  }

  /**
   * Number of distinct pattern textures currently cached. Useful for tests.
   */
  get size(): number {
    return this.map.size;
  }

  private evictIfNeeded() {
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      const entry = this.map.get(oldest);
      if (entry) entry.tex.dispose();
      this.map.delete(oldest);
    }
  }
}

/**
 * Build a stable, content-derived key for a 2D pattern matrix.
 *
 * We avoid JSON.stringify (allocation-heavy) and walk the matrix in one
 * pass building a string. This is fast enough for the typical
 * pattern sizes (<200 cells) and stable for matrixes with the same
 * content but different object identity.
 */
function patternKey(pattern: number[][]): string {
  if (pattern.length === 0) return '0x0';
  const h = pattern.length;
  const w = pattern[0].length;
  let key = `${w}x${h};`;
  for (let y = 0; y < h; y++) {
    const row = pattern[y];
    for (let x = 0; x < w; x++) {
      // Use '0' and '1' so each cell is a single byte; this also keeps
      // the key length predictable.
      key += row[x] > 0 ? '1' : '0';
    }
    key += '|';
  }
  return key;
}
