import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { ResolveCellColor } from './cellColor';

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
    try {
      (tex as unknown as Record<string, unknown>)['colorSpace'] = (
        THREE as unknown as Record<string, unknown>
      )['SRGBColorSpace'];
    } catch {
      /* noop */
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
  resolveCellColor: ResolveCellColor;
  colorScratch: THREE.Color;
  debugLogs: boolean;
}): number {
  const { grid, ages, heat, lifeTex, resolveCellColor, colorScratch, debugLogs } = params;
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
        const intensity = resolveCellColor(idx, grid, ages, heat, colorScratch);
        data[di + 0] = Math.round(colorScratch.r * 255);
        data[di + 1] = Math.round(colorScratch.g * 255);
        data[di + 2] = Math.round(colorScratch.b * 255);
        data[di + 3] = Math.round(255 * Math.min(1, Math.max(0.05, intensity)));
      } else {
        data[di + 0] = 0;
        data[di + 1] = 0;
        data[di + 2] = 0;
        data[di + 3] = 0;
      }
    }
  }

  if (aliveCount > 0 && debugLogs && Math.random() < 0.01) {
    // eslint-disable-next-line no-console
    console.log(`[PlanetLife] writeLifeTexture: alive=${aliveCount}`);
  }

  lifeTex.tex.needsUpdate = true;
  return aliveCount;
}
