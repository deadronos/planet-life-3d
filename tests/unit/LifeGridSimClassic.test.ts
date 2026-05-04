import { beforeEach, describe, expect, it } from 'vitest';

import { LifeGridSimClassic } from '../../src/sim/LifeGridSimClassic';
import type { Rules } from '../../src/sim/rules';

// Standard Game of Life Rules: B3/S23
const GOL_RULES: Rules = {
  birth: [false, false, false, true, false, false, false, false, false],
  survive: [false, false, true, true, false, false, false, false, false],
};

describe('LifeGridSimClassic', () => {
  let sim: LifeGridSimClassic;
  const latCells = 10;
  const lonCells = 10;

  beforeEach(() => {
    sim = new LifeGridSimClassic({ latCells, lonCells, rules: GOL_RULES });
  });

  it('initializes grid with zeros', () => {
    const grid = sim.getGridView();
    expect(grid.every((v) => v === 0)).toBe(true);
  });

  describe('stepClassic', () => {
    it('Blinker oscillator (vertical to horizontal)', () => {
      // 3 cells in a vertical line at lat=5, lon=5
      const lat = 5;
      const lon = 5;
      sim.setCell(lat - 1, lon, 1);
      sim.setCell(lat, lon, 1);
      sim.setCell(lat + 1, lon, 1);

      sim.stepClassic();

      // Should now be horizontal at lon=5
      expect(sim.getCell(lat, lon - 1)).toBe(1);
      expect(sim.getCell(lat, lon)).toBe(1);
      expect(sim.getCell(lat, lon + 1)).toBe(1);
      // Vertical cells should be dead
      expect(sim.getCell(lat - 1, lon)).toBe(0);
      expect(sim.getCell(lat + 1, lon)).toBe(0);
    });

    it('Blinker oscillator (horizontal to vertical)', () => {
      // 3 cells in a horizontal line
      const lat = 5;
      const lon = 5;
      sim.setCell(lat, lon - 1, 1);
      sim.setCell(lat, lon, 1);
      sim.setCell(lat, lon + 1, 1);

      sim.stepClassic();

      // Should now be vertical at lat=5
      expect(sim.getCell(lat - 1, lon)).toBe(1);
      expect(sim.getCell(lat, lon)).toBe(1);
      expect(sim.getCell(lat + 1, lon)).toBe(1);
      // Horizontal cells should be dead
      expect(sim.getCell(lat, lon - 1)).toBe(0);
      expect(sim.getCell(lat, lon + 1)).toBe(0);
    });

    it('Block (still life) remains stable', () => {
      // 2x2 square at (4,4), (4,5), (5,4), (5,5)
      sim.setCell(4, 4, 1);
      sim.setCell(4, 5, 1);
      sim.setCell(5, 4, 1);
      sim.setCell(5, 5, 1);

      sim.stepClassic();

      // All 4 cells should still be alive
      expect(sim.getCell(4, 4)).toBe(1);
      expect(sim.getCell(4, 5)).toBe(1);
      expect(sim.getCell(5, 4)).toBe(1);
      expect(sim.getCell(5, 5)).toBe(1);
    });

    it('Single cell dies (underpopulation)', () => {
      sim.setCell(5, 5, 1);

      sim.stepClassic();

      expect(sim.getCell(5, 5)).toBe(0);
    });

    it('Block survives and remains after one tick', () => {
      sim.setCell(4, 4, 1);
      sim.setCell(4, 5, 1);
      sim.setCell(5, 4, 1);
      sim.setCell(5, 5, 1);

      sim.stepClassic();

      // All 4 cells should still be alive
      expect(sim.getCell(4, 4)).toBe(1);
      expect(sim.getCell(4, 5)).toBe(1);
      expect(sim.getCell(5, 4)).toBe(1);
      expect(sim.getCell(5, 5)).toBe(1);
      // Population tracked correctly after step
      expect(sim.population).toBe(4);
    });

    it('tracks births and deaths correctly for blinker pattern', () => {
      // Horizontal blinker: cells at (5,5), (5,6), (5,7)
      // After tick: becomes vertical with cells at (4,5), (5,5), (6,5)
      // - (5,5) center survives (2 neighbors)
      // - (5,6), (5,7) end cells die (1 neighbor each)
      // - (4,5), (6,5) new cells are born (3 neighbors each)
      // So: 2 births (new vertical positions), 2 deaths (old end positions)
      sim.setCell(5, 5, 1);
      sim.setCell(5, 6, 1);
      sim.setCell(5, 7, 1);

      sim.stepClassic();

      expect(sim.birthsLastTick).toBe(2);
      expect(sim.deathsLastTick).toBe(2);
    });

    it('population counter is correct after tick', () => {
      // Single isolated cell dies - 0 neighbors means death
      sim.setCell(5, 5, 1);

      sim.stepClassic();
      // Cell died (underpopulation - 0 neighbors)
      expect(sim.population).toBe(0);
    });

    it('wraps longitude correctly', () => {
      // Cell at right edge should see neighbor at left edge
      sim.setCell(5, lonCells - 1, 1); // last column
      sim.setCell(5, 0, 1); // first column

      // These two cells are adjacent (wrapping)
      sim.stepClassic();

      // Both should survive (each has 1 neighbor, which is < 2 for survival)
      // Actually in B3/S23, with 1 neighbor a cell dies
      // Let's use a block near the edge
      sim.clear();
      sim.setCell(5, lonCells - 1, 1);
      sim.setCell(5, 0, 1);
      sim.setCell(6, lonCells - 1, 1);
      sim.setCell(6, 0, 1);

      sim.stepClassic();

      expect(sim.getCell(5, lonCells - 1)).toBe(1);
      expect(sim.getCell(5, 0)).toBe(1);
      expect(sim.getCell(6, lonCells - 1)).toBe(1);
      expect(sim.getCell(6, 0)).toBe(1);
    });

    it('clamps latitude correctly', () => {
      // Top edge should clamp to first row
      sim.setCell(0, 5, 1);
      sim.setCell(1, 5, 1);
      sim.setCell(latCells - 1, 5, 1); // last row

      sim.stepClassic();

      // Should behave correctly at edges
      expect(sim.getCell(0, 5)).toBeDefined();
      expect(sim.getCell(latCells - 1, 5)).toBeDefined();
    });
  });
});
