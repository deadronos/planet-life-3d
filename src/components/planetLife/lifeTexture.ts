import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export type LifeTexture = {
  data: Uint8Array;
  tex: THREE.DataTexture;
  w: number;
  h: number;
};

export function useLifeTexture(params: { lonCells: number; latCells: number }): LifeTexture {
  const lifeTex = useMemo(() => {
    const w = params.lonCells;
    const h = params.latCells;
    const data = new Uint8Array(w * h * 4);
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.flipY = false;

    // colorSpace is the modern three.js name; tolerate older builds.
    if ('SRGBColorSpace' in THREE) {
      (tex as unknown as Record<string, unknown>)['colorSpace'] = (
        THREE as unknown as Record<string, unknown>
      )['SRGBColorSpace'];
    }

    tex.needsUpdate = true;
    return { data, tex, w, h };
  }, [params.latCells, params.lonCells]);

  useEffect(() => {
    return () => {
      lifeTex.tex.dispose();
    };
  }, [lifeTex]);

  return lifeTex;
}

/**
 * Precomputed mapping from a raw neighbour count to its normalised byte.
 *
 * The inner loop below runs for every cell on every tick, so the division,
 * floor and clamp are replaced with a single array read. The table is built
 * from the original expression so the two can never drift, and it spans the
 * whole byte range rather than just the 0-8 the simulation normally produces,
 * which keeps the original defensive clamp for out-of-range values.
 */
const HEAT_TO_BYTE = (() => {
  const table = new Uint8Array(256);
  for (let h = 0; h < 256; h++) {
    table[h] = Math.min(255, Math.floor((h / 8.0) * 255));
  }
  return table;
})();

export function writeLifeTexture(params: {
  grid: Uint8Array;
  ages: Uint8Array;
  heat: Uint8Array;
  lifeTex: LifeTexture;

  gameMode: 'Classic' | 'Colony';
  debugLogs: boolean;
}): number {
  const { grid, ages, heat, lifeTex, gameMode, debugLogs } = params;
  const { data, w, h } = lifeTex;

  // The running total is the function's return value, so it is always
  // accumulated - gating it behind `debugLogs` would silently hand callers a
  // population of 0.
  let aliveCount = 0;

  // Map sim lat index 0 (south pole) to texture v=0 (bottom).
  // DataTexture (flipY=false) maps row 0 to V=0.
  for (let la = 0; la < h; la++) {
    const srcRow = la * w;
    const dstRow = la * w;
    for (let lo = 0; lo < w; lo++) {
      const idx = srcRow + lo;
      const alive = grid[idx] > 0;

      // Sim column `lo` is stored directly at Texture column `lo`, matching
      // the GPU simulation texture convention. The overlay vertex shader
      // mirrors U (vUv.x = 1.0 - uv.x) to compensate for three.js
      // SphereGeometry UVs running opposite to the sim's longitude mapping,
      // so no column reversal belongs here (doing both would mirror the
      // rendered life east-west).
      const dstLo = lo;
      const di = (dstRow + dstLo) * 4;

      if (alive) {
        aliveCount++;
      }

      // Write raw simulation data to texture (R=State, G=Age, B=Heat, A=1.0)
      // This matches the format used by the GPU simulation shader.

      // R Channel: State
      if (gameMode === 'Colony') {
        // Colony Mode: 0=Dead, 1=Colony A (0.33), 2=Colony B (0.67)
        const val = grid[idx];
        if (val === 1)
          data[di] = 84; // ~0.33 * 255
        else if (val === 2)
          data[di] = 171; // ~0.67 * 255
        else data[di] = 0;
      } else {
        // Classic Mode: 0=Dead, 1=Alive (1.0)
        data[di] = alive ? 255 : 0;
      }

      // G Channel: Age
      // CPU sim ages are 0-255. Shader reads them as 0-1.
      data[di + 1] = ages[idx];

      // B Channel: Neighbor Heat
      // CPU sim heat is neighbour count (0-8). Shader expects normalized heat
      // (0-1), mapped onto 0-255. Values beyond the normal range are still
      // clamped by the table.
      data[di + 2] = HEAT_TO_BYTE[heat[idx]];

      // A Channel: Always opaque
      // The fragment shader discard logic handles transparency based on R channel (state < 0.02)
      data[di + 3] = 255;
    }
  }

  if (aliveCount > 0 && debugLogs && Math.random() < 0.01) {
    // eslint-disable-next-line no-console
    console.log(`[PlanetLife] writeLifeTexture: alive=${aliveCount}`);
  }

  lifeTex.tex.needsUpdate = true;
  return aliveCount;
}
