import { beforeEach, describe, expect, it } from 'vitest';

import {
  adjustNeighborsForEcology,
  computeEcologySample,
  type EcologyProfileName,
} from '../../src/sim/ecology';
import { LifeGridSim } from '../../src/sim/LifeGridSim';
import type { Offset } from '../../src/sim/patterns';
import type { Rules } from '../../src/sim/rules';

// Standard Game of Life Rules: B3/S23
const GOL_RULES: Rules = {
  birth: [false, false, false, true, false, false, false, false, false],
  survive: [false, false, true, true, false, false, false, false, false],
};

describe('LifeGridSim', () => {
  let sim: LifeGridSim;
  const latCells = 10;
  const lonCells = 10;

  beforeEach(() => {
    sim = new LifeGridSim({ latCells, lonCells, rules: GOL_RULES });
  });

  it('initializes grid with zeros', () => {
    const grid = sim.getGridView();
    expect(grid.every((v) => v === 0)).toBe(true);
  });

  it('wraps longitude and clamps latitude', () => {
    sim.setCell(-1, -1, 1);
    expect(sim.getCell(0, lonCells - 1)).toBe(1);

    sim.setCell(latCells + 99, lonCells, 1);
    expect(sim.getCell(latCells - 1, 0)).toBe(1);
  });

  it('executes step correctly (Blinker)', () => {
    const lat = 5;
    const lon = 5;
    sim.setCell(lat - 1, lon, 1);
    sim.setCell(lat, lon, 1);
    sim.setCell(lat + 1, lon, 1);

    sim.step();

    expect(sim.getCell(lat, lon)).toBe(1);
    expect(sim.getCell(lat, lon - 1)).toBe(1);
    expect(sim.getCell(lat, lon + 1)).toBe(1);
    expect(sim.getCell(lat - 1, lon)).toBe(0);
    expect(sim.getCell(lat + 1, lon)).toBe(0);
  });

  it('seedAtCell applies offsets', () => {
    const offsets: Offset[] = [
      [0, 0],
      [0, 1],
    ];
    sim.seedAtCell({
      lat: 5,
      lon: 5,
      offsets,
      mode: 'set',
      scale: 1,
      jitter: 0,
      probability: 1,
    });

    expect(sim.getCell(5, 5)).toBe(1);
    expect(sim.getCell(5, 6)).toBe(1);
    expect(sim.getCell(5, 7)).toBe(0);
  });

  it('can bias birth thresholds from ecology layers', () => {
    const profile: EcologyProfileName = 'Garden World';
    let target: { lat: number; lon: number } | undefined;

    for (let lat = 1; lat < latCells - 1 && !target; lat++) {
      for (let lon = 1; lon < lonCells - 1; lon++) {
        if (computeEcologySample({ lat, lon, latCells, lonCells, profile }).neighborBias === 1) {
          target = { lat, lon };
          break;
        }
      }
    }

    expect(target).toBeDefined();
    if (!target) return;

    sim.setEcologyProfile(profile);
    sim.setCell(target.lat, target.lon - 1, 1);
    sim.setCell(target.lat, target.lon + 1, 1);

    expect(adjustNeighborsForEcology(2, target.lat, target.lon, latCells, lonCells, profile)).toBe(
      3,
    );

    sim.step();

    expect(sim.getCell(target.lat, target.lon)).toBe(1);
  });
});
