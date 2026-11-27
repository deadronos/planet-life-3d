import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { createEcologyBiasTexture } from '../../src/components/gpuSimulation/ecologyBiasTexture';
import {
  adjustNeighborsForEcology,
  buildEcologyBiasTable,
  computeEcologySample,
  ECOLOGY_PROFILE_NAMES,
  type EcologyProfileName,
} from '../../src/sim/ecology';
import { LifeGridSim } from '../../src/sim/LifeGridSim';
import { LifeGridSimClassic } from '../../src/sim/LifeGridSimClassic';
import { LifeGridSimColony } from '../../src/sim/LifeGridSimColony';
import type { Rules } from '../../src/sim/rules';
import { createSeededRng } from '../../src/sim/seededRng';

const GOL_RULES: Rules = {
  birth: [false, false, false, true, false, false, false, false, false],
  survive: [false, false, true, true, false, false, false, false, false],
};

function decodeShaderBiasByte(byte: number): -1 | 0 | 1 {
  const normalized = byte / 255;
  if (normalized > 0.75) return 1;
  if (normalized < 0.25) return -1;
  return 0;
}

function stepReferenceClassic(
  grid: Uint8Array,
  latCells: number,
  lonCells: number,
  rules: Rules,
  profile: EcologyProfileName,
): Uint8Array {
  const next = new Uint8Array(latCells * lonCells);
  for (let lat = 0; lat < latCells; lat++) {
    for (let lon = 0; lon < lonCells; lon++) {
      let rawNeighbors = 0;
      for (let dLat = -1; dLat <= 1; dLat++) {
        const nLat = lat + dLat;
        if (nLat < 0 || nLat >= latCells) continue;
        for (let dLon = -1; dLon <= 1; dLon++) {
          if (dLat === 0 && dLon === 0) continue;
          const nLon = (lon + dLon + lonCells) % lonCells;
          if (grid[nLat * lonCells + nLon] > 0) rawNeighbors++;
        }
      }
      const effective = adjustNeighborsForEcology(
        rawNeighbors,
        lat,
        lon,
        latCells,
        lonCells,
        profile,
      );
      const idx = lat * lonCells + lon;
      const alive = grid[idx] > 0;
      next[idx] = (alive ? rules.survive[effective] : rules.birth[effective]) ? 1 : 0;
    }
  }
  return next;
}

function stepReferenceColony(
  grid: Uint8Array,
  latCells: number,
  lonCells: number,
  rules: Rules,
  profile: EcologyProfileName,
): Uint8Array {
  const next = new Uint8Array(latCells * lonCells);
  for (let lat = 0; lat < latCells; lat++) {
    for (let lon = 0; lon < lonCells; lon++) {
      let rawNeighbors = 0;
      let countA = 0;
      for (let dLat = -1; dLat <= 1; dLat++) {
        const nLat = lat + dLat;
        if (nLat < 0 || nLat >= latCells) continue;
        for (let dLon = -1; dLon <= 1; dLon++) {
          if (dLat === 0 && dLon === 0) continue;
          const nLon = (lon + dLon + lonCells) % lonCells;
          const val = grid[nLat * lonCells + nLon];
          if (val > 0) {
            rawNeighbors++;
            if (val === 1) countA++;
          }
        }
      }
      const effective = adjustNeighborsForEcology(
        rawNeighbors,
        lat,
        lon,
        latCells,
        lonCells,
        profile,
      );
      const idx = lat * lonCells + lon;
      const current = grid[idx];
      if (current > 0) {
        next[idx] = rules.survive[effective] ? current : 0;
      } else if (rules.birth[effective]) {
        next[idx] = countA >= 2 ? 1 : 2;
      }
    }
  }
  return next;
}

describe('Ecology bias caching & CPU/GPU parity (#218)', () => {
  it('buildEcologyBiasTable matches computeEcologySample across all profiles', () => {
    const dimensions = [
      { latCells: 8, lonCells: 8 },
      { latCells: 16, lonCells: 32 },
      { latCells: 21, lonCells: 35 },
    ];

    for (const { latCells, lonCells } of dimensions) {
      for (const profile of ECOLOGY_PROFILE_NAMES) {
        const table = buildEcologyBiasTable(latCells, lonCells, profile);
        expect(table).toBeInstanceOf(Int8Array);
        expect(table.length).toBe(latCells * lonCells);

        for (let lat = 0; lat < latCells; lat++) {
          for (let lon = 0; lon < lonCells; lon++) {
            const expected = computeEcologySample({
              lat,
              lon,
              latCells,
              lonCells,
              profile,
            }).neighborBias;
            expect(table[lat * lonCells + lon]).toBe(expected);
          }
        }
      }
    }
  });

  it('LifeGridSimBase keeps ecologyBias null for None and caches Int8Array for active profiles', () => {
    const sim = new LifeGridSim({ latCells: 12, lonCells: 24, rules: GOL_RULES });
    expect(sim.getEcologyBiasView()).toBeNull();

    for (const profile of ECOLOGY_PROFILE_NAMES) {
      sim.setEcologyProfile(profile);
      const bias = sim.getEcologyBiasView();
      if (profile === 'None') {
        expect(bias).toBeNull();
      } else {
        expect(bias).toBeInstanceOf(Int8Array);
        expect(bias!.length).toBe(12 * 24);
        for (let lat = 0; lat < 12; lat++) {
          for (let lon = 0; lon < 24; lon++) {
            const expected = computeEcologySample({
              lat,
              lon,
              latCells: 12,
              lonCells: 24,
              profile,
            }).neighborBias;
            expect(bias![lat * 24 + lon]).toBe(expected);
          }
        }
      }
    }

    // Returning to None clears the cached lookup table to preserve zero overhead.
    sim.setEcologyProfile('None');
    expect(sim.getEcologyBiasView()).toBeNull();
  });

  it('stepClassicGrid produces identical results to reference adjustNeighborsForEcology across all profiles', () => {
    const latCells = 18;
    const lonCells = 28;

    for (const profile of ECOLOGY_PROFILE_NAMES) {
      const sim = new LifeGridSimClassic({ latCells, lonCells, rules: GOL_RULES });
      sim.setEcologyProfile(profile);
      sim.randomize(0.35, createSeededRng(42));

      let refGrid: Uint8Array = new Uint8Array(sim.getGridView());

      for (let tick = 0; tick < 5; tick++) {
        sim.stepClassic();
        refGrid = stepReferenceClassic(refGrid, latCells, lonCells, GOL_RULES, profile);
        expect(sim.getGridView()).toEqual(refGrid);
      }
    }
  });

  it('stepColonyGrid produces identical results to reference adjustNeighborsForEcology across all profiles', () => {
    const latCells = 18;
    const lonCells = 28;

    for (const profile of ECOLOGY_PROFILE_NAMES) {
      const sim = new LifeGridSimColony({ latCells, lonCells, rules: GOL_RULES });
      sim.setGameMode('Colony');
      sim.setEcologyProfile(profile);
      sim.randomize(0.35, createSeededRng(99));

      let refGrid: Uint8Array = new Uint8Array(sim.getGridView());

      for (let tick = 0; tick < 5; tick++) {
        sim.stepColony();
        refGrid = stepReferenceColony(refGrid, latCells, lonCells, GOL_RULES, profile);
        expect(sim.getGridView()).toEqual(refGrid);
      }
    }
  });

  it('createEcologyBiasTexture bakes NearestFilter DataTexture aligned 1:1 with computeEcologySample', () => {
    const resolution = { width: 32, height: 16 };

    const noneTex = createEcologyBiasTexture(resolution, 'None');
    expect(noneTex.minFilter).toBe(THREE.NearestFilter);
    expect(noneTex.magFilter).toBe(THREE.NearestFilter);
    expect(noneTex.flipY).toBe(false);
    expect(noneTex.generateMipmaps).toBe(false);
    expect(noneTex.image.width).toBe(1);
    expect(noneTex.image.height).toBe(1);
    expect(decodeShaderBiasByte((noneTex.image.data as Uint8Array)[0])).toBe(0);
    noneTex.dispose();

    for (const profile of ECOLOGY_PROFILE_NAMES) {
      if (profile === 'None') continue;
      const tex = createEcologyBiasTexture(resolution, profile);
      expect(tex.minFilter).toBe(THREE.NearestFilter);
      expect(tex.magFilter).toBe(THREE.NearestFilter);
      expect(tex.wrapS).toBe(THREE.RepeatWrapping);
      expect(tex.wrapT).toBe(THREE.ClampToEdgeWrapping);
      expect(tex.flipY).toBe(false);
      expect(tex.generateMipmaps).toBe(false);
      expect(tex.image.width).toBe(resolution.width);
      expect(tex.image.height).toBe(resolution.height);

      const data = tex.image.data as Uint8Array;
      for (let lat = 0; lat < resolution.height; lat++) {
        for (let lon = 0; lon < resolution.width; lon++) {
          const byte = data[(lat * resolution.width + lon) * 4];
          const expected = computeEcologySample({
            lat,
            lon,
            latCells: resolution.height,
            lonCells: resolution.width,
            profile,
          }).neighborBias;
          expect(decodeShaderBiasByte(byte)).toBe(expected);
        }
      }
      tex.dispose();
    }
  });
});
