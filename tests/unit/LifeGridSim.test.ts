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

  it('randomize() resets generation, births and deaths (matches clear())', () => {
    // Run a few steps so generation, births and deaths are non-zero.
    sim.setCell(4, 5, 1);
    sim.setCell(5, 5, 1);
    sim.setCell(6, 5, 1);
    sim.step();
    sim.step();
    expect(sim.generation).toBeGreaterThan(0);

    sim.randomize(0);

    // After randomize, the HUD should read as a fresh world: generation
    // back to 0, no births/deaths attributed to the previous tick, and
    // population matching the (re-randomized) grid.
    expect(sim.generation).toBe(0);
    expect(sim.birthsLastTick).toBe(0);
    expect(sim.deathsLastTick).toBe(0);
    expect(sim.population).toBeGreaterThanOrEqual(0);
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

  it('tracks Classic generation, population, age, neighborHeat, and alive indices through step()', () => {
    // Horizontal blinker at lat=5, lon=4..6
    sim.setCell(5, 4, 1);
    sim.setCell(5, 5, 1);
    sim.setCell(5, 6, 1);

    sim.step();

    expect(sim.generation).toBe(1);
    expect(sim.population).toBe(3);
    expect(sim.birthsLastTick).toBe(2);
    expect(sim.deathsLastTick).toBe(2);
    expect(sim.getAliveCount()).toBe(3);

    // Center cell survived (age incremented from 1 -> 2, had 2 neighbors)
    const centerIdx = 5 * lonCells + 5;
    expect(sim.getAgeView()[centerIdx]).toBe(2);
    expect(sim.getNeighborHeatView()[centerIdx]).toBe(2);

    // Newly born top cell (age 1, had 3 neighbors)
    const topIdx = 4 * lonCells + 5;
    expect(sim.getAgeView()[topIdx]).toBe(1);
    expect(sim.getNeighborHeatView()[topIdx]).toBe(3);

    const alive: number[] = [];
    sim.forEachAlive((idx) => alive.push(idx));
    expect(alive).toEqual([4 * lonCells + 5, centerIdx, 6 * lonCells + 5]);
  });

  it('executes Colony mode stepping via step()', () => {
    sim.setGameMode('Colony');

    // Colony A birth at (5,5): 2 type-1 and 1 type-2 non-adjacent neighbors -> countA=2 >= 2 -> type 1
    sim.setCell(4, 4, 1);
    sim.setCell(4, 6, 1);
    sim.setCell(6, 5, 2);

    sim.step();

    expect(sim.generation).toBe(1);
    expect(sim.getCell(5, 5)).toBe(1);
    expect(sim.birthsLastTick).toBe(1);
    expect(sim.deathsLastTick).toBe(3);
    expect(sim.population).toBe(1);
    expect(sim.getAliveCount()).toBe(1);

    // Colony B birth at (5,5): 1 type-1 and 2 type-2 non-adjacent neighbors -> countA=1 < 2 -> type 2
    sim.clear();
    sim.setCell(4, 4, 1);
    sim.setCell(4, 6, 2);
    sim.setCell(6, 5, 2);

    sim.step();

    expect(sim.generation).toBe(1);
    expect(sim.getCell(5, 5)).toBe(2);
    expect(sim.birthsLastTick).toBe(1);
    expect(sim.deathsLastTick).toBe(3);
    expect(sim.population).toBe(1);
    expect(sim.getAliveCount()).toBe(1);
  });

  it('switches cleanly between Classic and Colony stepping on the same instance', () => {
    sim.setGameMode('Colony');
    sim.setCell(4, 4, 2);
    sim.setCell(4, 5, 2);
    sim.setCell(5, 4, 2);
    sim.setCell(5, 5, 2);

    sim.step();
    expect(sim.getCell(4, 4)).toBe(2);
    expect(sim.generation).toBe(1);

    // Switch back to Classic and step a Classic blinker
    sim.clear();
    sim.setGameMode('Classic');
    sim.setCell(5, 4, 1);
    sim.setCell(5, 5, 1);
    sim.setCell(5, 6, 1);

    sim.step();
    expect(sim.getCell(4, 5)).toBe(1);
    expect(sim.getCell(5, 5)).toBe(1);
    expect(sim.getCell(6, 5)).toBe(1);
    expect(sim.generation).toBe(1);
    expect(sim.population).toBe(3);
  });

  it('keeps aliveIndices and population in sync when setCell toggles liveness (#186)', () => {
    expect(sim.population).toBe(0);
    expect(sim.getAliveCount()).toBe(0);

    sim.setCell(5, 5, 1);
    sim.setCell(5, 6, 2);
    expect(sim.population).toBe(2);
    expect(sim.getAliveCount()).toBe(2);

    const alive: number[] = [];
    sim.forEachAlive((idx) => alive.push(idx));
    expect(alive).toEqual([5 * lonCells + 5, 5 * lonCells + 6]);

    // Clearing one cell updates population and aliveIndices immediately
    sim.setCell(5, 5, 0);
    expect(sim.population).toBe(1);
    expect(sim.getAliveCount()).toBe(1);
    const remaining: number[] = [];
    sim.forEachAlive((idx) => remaining.push(idx));
    expect(remaining).toEqual([5 * lonCells + 6]);
  });

  it('normalizes Colony B (2) cells to Classic (1) when switching Colony -> Classic (#184)', () => {
    sim.setGameMode('Colony');
    // 2x2 Colony B block at (4..5, 4..5): still life in Conway rules
    sim.setCell(4, 4, 2);
    sim.setCell(4, 5, 2);
    sim.setCell(5, 4, 2);
    sim.setCell(5, 5, 2);

    sim.setGameMode('Classic');
    expect(sim.getCell(4, 4)).toBe(1);
    expect(sim.getCell(5, 5)).toBe(1);

    // Each cell has 3 neighbors (not 6!), so the 2x2 block must survive
    sim.step();
    expect(sim.population).toBe(4);
    expect(sim.getCell(4, 4)).toBe(1);
    expect(sim.getCell(5, 5)).toBe(1);
  });

  it('computes continuous ecology samples across the longitude seam (#185)', () => {
    const sampleLon0 = computeEcologySample({
      lat: 6,
      lon: 0,
      latCells: 64,
      lonCells: 128,
      profile: 'Garden World',
    });
    const sampleLonEnd = computeEcologySample({
      lat: 6,
      lon: 127,
      latCells: 64,
      lonCells: 128,
      profile: 'Garden World',
    });
    const sampleLon1 = computeEcologySample({
      lat: 6,
      lon: 1,
      latCells: 64,
      lonCells: 128,
      profile: 'Garden World',
    });

    // Seam step (127 -> 0) should be comparable to an interior 1-cell step (0 -> 1)
    const seamDiff = Math.abs(sampleLon0.altitude - sampleLonEnd.altitude);
    const interiorDiff = Math.abs(sampleLon0.altitude - sampleLon1.altitude);
    expect(seamDiff).toBeLessThan(0.25);
    expect(Math.abs(seamDiff - interiorDiff)).toBeLessThan(0.1);
  });
});
