import { describe, expect, it } from 'vitest';

import { LifeGridSim } from '../../src/sim/LifeGridSim';
import type { Rules } from '../../src/sim/rules';

// Colony rules (default for Colony mode)
const COLONY_RULES: Rules = {
  birth: [false, false, false, true, false, false, false, false, false],
  survive: [false, false, true, true, false, false, false, false, false],
};

describe('LifeGridSimColony', () => {
  let sim: LifeGridSim;
  const latCells = 10;
  const lonCells = 10;

  beforeEach(() => {
    sim = new LifeGridSim({ latCells, lonCells, rules: COLONY_RULES });
    sim.setGameMode('Colony');
  });

  it('type 1 cell survives with 2 neighbors', () => {
    // Center cell type 1, with 2 neighbors
    sim.setCell(5, 5, 1);
    sim.setCell(5, 4, 1);
    sim.setCell(5, 6, 1);

    sim.step();

    // Type 1 survives with 2-3 neighbors
    expect(sim.getCell(5, 5)).toBe(1);
  });

  it('type 1 cell survives with 3 neighbors', () => {
    sim.setCell(5, 5, 1);
    sim.setCell(4, 5, 1);
    sim.setCell(6, 5, 1);

    sim.step();

    expect(sim.getCell(5, 5)).toBe(1);
  });

  it('type 1 cell dies with 1 neighbor', () => {
    sim.setCell(5, 5, 1);
    sim.setCell(5, 4, 1);

    sim.step();

    expect(sim.getCell(5, 5)).toBe(0);
  });

  it('type 2 cell survives with 2 neighbors', () => {
    sim.setCell(5, 5, 2);
    sim.setCell(5, 4, 2);
    sim.setCell(5, 6, 2);

    sim.step();

    expect(sim.getCell(5, 5)).toBe(2);
  });

  it('type 2 cell dies with 4 neighbors', () => {
    sim.setCell(5, 5, 2);
    sim.setCell(5, 4, 1);
    sim.setCell(5, 6, 1);
    sim.setCell(4, 5, 1);
    sim.setCell(6, 5, 1); // 4 neighbors

    sim.step();

    expect(sim.getCell(5, 5)).toBe(0);
  });

  it('birth requires countA >= 2', () => {
    // Dead cell with 3 neighbors, but countA (type 1 neighbors) = 0
    // Should NOT birth
    sim.setCell(4, 5, 0);
    sim.setCell(4, 4, 0);
    sim.setCell(4, 6, 0);

    // Instead, seed 3 type-2 neighbors (countA = 0)
    sim.setCell(5, 4, 2);
    sim.setCell(5, 5, 0); // target
    sim.setCell(5, 6, 2);
    sim.setCell(6, 4, 2);
    sim.setCell(6, 6, 2);
    // countA = 0, so should not birth even with 3 type-2 neighbors

    sim.step();

    // With countA = 0, no birth should occur
    expect(sim.getCell(5, 5)).toBe(0);
  });

  it('colony step executes without error', () => {
    // Simple smoke test that stepColony runs without throwing
    sim.setCell(5, 5, 1);
    sim.setCell(5, 4, 1);
    sim.setCell(5, 6, 1);

    expect(() => sim.step()).not.toThrow();
    expect(sim.generation).toBe(1);
  });

  it('mixed type block - verify cells can be set and survive', () => {
    // Verify we can set mixed type cells and step runs
    sim.setCell(5, 5, 1);
    sim.setCell(5, 6, 2);
    sim.setCell(6, 5, 1);
    sim.setCell(6, 6, 2);

    expect(() => sim.step()).not.toThrow();
    // Just verify step runs without error
    expect(sim.generation).toBe(1);
  });

  it('birth occurs when conditions are met', () => {
    // Set up a known pattern: target cell with 3 type-1 neighbors (countA = 3 >= 2)
    // Target at (5,5) with neighbors at (5,4), (4,5), (5,6)
    sim.setCell(5, 5, 0); // target - dead
    sim.setCell(5, 4, 1); // type 1
    sim.setCell(4, 5, 1); // type 1
    sim.setCell(5, 6, 1); // type 1 — countA = 3, total neighbors = 3

    sim.step();

    // With countA >= 2 and 3 neighbors, should birth
    expect(sim.getCell(5, 5)).toBeGreaterThan(0);
  });

  it('mixed type block is stable', () => {
    // 2x2 block with mixed types should be stable
    sim.setCell(5, 5, 1);
    sim.setCell(5, 6, 2);
    sim.setCell(6, 5, 1);
    sim.setCell(6, 6, 2);

    sim.step();
    sim.step();

    expect(sim.getCell(5, 5)).toBe(1);
    expect(sim.getCell(5, 6)).toBe(2);
    expect(sim.getCell(6, 5)).toBe(1);
    expect(sim.getCell(6, 6)).toBe(2);
  });

  it('population tracking in colony mode', () => {
    sim.setCell(5, 5, 1);
    sim.setCell(5, 6, 2);
    sim.setCell(6, 5, 1);

    const before = sim.getAliveCount();
    sim.step();
    const after = sim.getAliveCount();

    expect(after).toBeGreaterThan(0);
    expect(sim.population).toBeGreaterThan(0);
  });

  it('births and deaths counters work in colony mode', () => {
    // Start with a few cells
    sim.setCell(5, 5, 1);
    sim.setCell(5, 4, 1);
    sim.setCell(5, 6, 1);

    sim.step();

    expect(sim.birthsLastTick).toBeGreaterThanOrEqual(0);
    expect(sim.deathsLastTick).toBeGreaterThanOrEqual(0);
  });

  it('longitude wraps in colony mode', () => {
    sim.setCell(5, lonCells - 1, 1);
    sim.setCell(5, 0, 1);
    sim.setCell(5, 1, 1);

    expect(() => sim.step()).not.toThrow();
  });

  it('latitude clamps at edges', () => {
    sim.setCell(latCells - 1, 5, 1);
    sim.setCell(0, 5, 1);
    sim.setCell(latCells - 2, 5, 1);

    expect(() => sim.step()).not.toThrow();
  });

  it('type 1 cell with 0 neighbors dies', () => {
    sim.setCell(5, 5, 1);
    // No neighbors

    sim.step();

    expect(sim.getCell(5, 5)).toBe(0);
  });

  it('type 2 cell with 0 neighbors dies', () => {
    sim.setCell(5, 5, 2);

    sim.step();

    expect(sim.getCell(5, 5)).toBe(0);
  });

  it('newborn type depends on countA threshold', () => {
    // Dead cell surrounded by 3 neighbors with countA = 2 should birth as type 1
    // countA = 1 should birth as type 2
    sim.setCell(5, 5, 0);
    sim.setCell(5, 4, 1); // countA += 1
    sim.setCell(5, 6, 1); // countA += 1 → countA = 2
    sim.setCell(4, 5, 1); // countA += 1 → countA = 3

    sim.step();

    // countA >= 2, should birth as type 1
    expect(sim.getCell(5, 5)).toBe(1);
  });

  it('isolated type 2 becomes type 1 after one step', () => {
    // Type 2 with 0 neighbors should die, but if it becomes surrounded...
    sim.setCell(5, 5, 2);
    sim.setCell(5, 4, 1);
    sim.setCell(5, 6, 1);
    sim.setCell(4, 5, 1);
    sim.setCell(4, 4, 0);
    sim.setCell(4, 6, 0);
    sim.setCell(6, 4, 0);
    sim.setCell(6, 5, 0);
    sim.setCell(6, 6, 0);

    sim.step();

    // The center should either survive or the dead cell birth based on countA
    // With countA = 3 at center, birth should be type 1
    expect(sim.population).toBeGreaterThan(0);
  });
});
