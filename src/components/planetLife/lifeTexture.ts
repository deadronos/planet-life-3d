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

  let aliveCount = 0;
  // Map sim lat index 0 (south pole) to texture v=0 (bottom).
  // DataTexture (flipY=false) maps row 0 to V=0.
  for (let la = 0; la < h; la++) {
    const srcRow = la * w;
    const dstRow = la * w;
    for (let lo = 0; lo < w; lo++) {
      const idx = srcRow + lo;
      const alive = grid[idx] > 0;

      // Three.js SphereGeometry UVs run opposite to our generic Lon mapping.
      // Our Sim: u=0.25 -> -90 deg. Three.js u=0.25 -> +90 deg.
      // So we map Sim column `lo` to Texture column `w - 1 - lo`.
      const dstLo = w - 1 - lo;
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
      // CPU sim heat is neighbor count (0-8). Shader expects normalized heat (0-1).
      // We map 0-8 count to 0-255 range.
      // Note: Math.min(255, ...) handles cases where heat might theoretically exceed 8 (unlikely but safe)
      data[di + 2] = Math.min(255, Math.floor((heat[idx] / 8.0) * 255));

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
