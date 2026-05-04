import { beforeEach, describe, expect, it } from 'vitest';

import { LifeGridSimColony } from '../../src/sim/LifeGridSimColony';
import type { Rules } from '../../src/sim/rules';

// Colony rules: type 1 and type 2 both survive with 2-3 neighbors
const COLONY_RULES: Rules = {
  birth: [false, false, false, true, false, false, false, false, false],
  survive: [false, false, true, true, false, false, false, false, false],
};

describe('LifeGridSimColony', () => {
  let sim: LifeGridSimColony;
  const latCells = 10;
  const lonCells = 10;

  beforeEach(() => {
    sim = new LifeGridSimColony({ latCells, lonCells, rules: COLONY_RULES });
    sim.setGameMode('Colony');
  });

  it('initializes grid with zeros', () => {
    const grid = sim.getGridView();
    expect(grid.every((v) => v === 0)).toBe(true);
  });

  describe('stepColony', () => {
    it('type 1 cell survives with 2 neighbors', () => {
      // Type 1 cell at center with 2 type 1 neighbors
      sim.setCell(5, 5, 1);
      sim.setCell(5, 4, 1);
      sim.setCell(5, 6, 1);

      sim.stepColony();

      // Center cell should survive
      expect(sim.getCell(5, 5)).toBe(1);
    });

    it('type 1 cell survives with 3 neighbors', () => {
      sim.setCell(5, 5, 1);
      sim.setCell(5, 4, 1);
      sim.setCell(5, 6, 1);
      sim.setCell(4, 5, 1);

      sim.stepColony();

      expect(sim.getCell(5, 5)).toBe(1);
    });

    it('type 2 cell survives with 2 neighbors', () => {
      sim.setCell(5, 5, 2);
      sim.setCell(5, 4, 2);
      sim.setCell(5, 6, 2);

      sim.stepColony();

      expect(sim.getCell(5, 5)).toBe(2);
    });

    it('type 2 cell survives with 3 neighbors', () => {
      sim.setCell(5, 5, 2);
      sim.setCell(5, 4, 2);
      sim.setCell(5, 6, 2);
      sim.setCell(4, 5, 2);

      sim.stepColony();

      expect(sim.getCell(5, 5)).toBe(2);
    });

    it('dead cell births type 1 when countA >= 2 and neighbors == 3', () => {
      // 3 type 1 neighbors -> new cell is type 1
      sim.setCell(5, 4, 1);
      sim.setCell(5, 6, 1);
      sim.setCell(4, 5, 1);

      sim.stepColony();

      expect(sim.getCell(5, 5)).toBe(1);
    });

    it('dead cell births type 2 when countA < 2 and neighbors == 3', () => {
      // 1 type 1 + 2 type 2 neighbors -> new cell is type 2 (countA=1 < 2)
      sim.setCell(5, 4, 2);
      sim.setCell(5, 6, 2);
      sim.setCell(4, 5, 1);

      sim.stepColony();

      expect(sim.getCell(5, 5)).toBe(2);
    });

    it('dead cell dies with fewer than 3 neighbors', () => {
      // Only 2 neighbors - no birth
      sim.setCell(5, 4, 1);
      sim.setCell(5, 6, 1);

      sim.stepColony();

      expect(sim.getCell(5, 5)).toBe(0);
    });

    it('type 1 cell dies with 4 neighbors (overpopulation)', () => {
      sim.setCell(5, 5, 1);
      sim.setCell(5, 4, 1);
      sim.setCell(5, 6, 1);
      sim.setCell(4, 5, 1);
      sim.setCell(6, 5, 1); // 4 neighbors

      sim.stepColony();

      expect(sim.getCell(5, 5)).toBe(0);
    });

    it('type 1 cell dies with 1 neighbor (underpopulation)', () => {
      sim.setCell(5, 5, 1);
      sim.setCell(5, 4, 1);

      sim.stepColony();

      expect(sim.getCell(5, 5)).toBe(0);
    });

    it('block of 4 type 1 cells remains stable', () => {
      sim.setCell(4, 4, 1);
      sim.setCell(4, 5, 1);
      sim.setCell(5, 4, 1);
      sim.setCell(5, 5, 1);

      sim.stepColony();

      expect(sim.getCell(4, 4)).toBe(1);
      expect(sim.getCell(4, 5)).toBe(1);
      expect(sim.getCell(5, 4)).toBe(1);
      expect(sim.getCell(5, 5)).toBe(1);
    });

    it('block of 4 type 2 cells remains stable', () => {
      sim.setCell(4, 4, 2);
      sim.setCell(4, 5, 2);
      sim.setCell(5, 4, 2);
      sim.setCell(5, 5, 2);

      sim.stepColony();

      expect(sim.getCell(4, 4)).toBe(2);
      expect(sim.getCell(4, 5)).toBe(2);
      expect(sim.getCell(5, 4)).toBe(2);
      expect(sim.getCell(5, 5)).toBe(2);
    });

    it('mixed type block remains stable', () => {
      // 2x2 block with mixed types
      sim.setCell(4, 4, 1);
      sim.setCell(4, 5, 2);
      sim.setCell(5, 4, 2);
      sim.setCell(5, 5, 1);

      sim.stepColony();

      // All should survive - each has 3 neighbors
      expect(sim.getCell(4, 4)).toBe(1);
      expect(sim.getCell(4, 5)).toBe(2);
      expect(sim.getCell(5, 4)).toBe(2);
      expect(sim.getCell(5, 5)).toBe(1);
    });

    it('tracks births correctly for colony', () => {
      // 3 type 1 neighbors will birth a type 1 cell
      sim.setCell(5, 4, 1);
      sim.setCell(5, 6, 1);
      sim.setCell(4, 5, 1);

      sim.stepColony();

      expect(sim.birthsLastTick).toBe(1);
    });

    it('tracks population for mixed types', () => {
      sim.setCell(4, 4, 1);
      sim.setCell(4, 5, 2);
      sim.setCell(5, 4, 1);
      sim.setCell(5, 5, 2);

      sim.stepColony();

      // Population unchanged for stable block - all 4 cells survive
      expect(sim.population).toBe(4);
    });

    it('wraps longitude in colony mode', () => {
      sim.setCell(5, lonCells - 1, 1);
      sim.setCell(5, 0, 1);
      sim.setCell(6, lonCells - 1, 1);
      sim.setCell(6, 0, 1);

      sim.stepColony();

      expect(sim.getCell(5, lonCells - 1)).toBe(1);
      expect(sim.getCell(5, 0)).toBe(1);
      expect(sim.getCell(6, lonCells - 1)).toBe(1);
      expect(sim.getCell(6, 0)).toBe(1);
    });
  });
});
