import { beforeEach, describe, expect, it } from 'vitest';

import { LifeSphereSim } from '../../src/sim/LifeSphereSim';
import type { Rules } from '../../src/sim/rules';

const GOL_RULES: Rules = {
  birth: [false, false, false, true, false, false, false, false, false],
  survive: [false, false, true, true, false, false, false, false, false],
};

describe('LifeSphereSim Colony Mode', () => {
  let sim: LifeSphereSim;
  const latCells = 10;
  const lonCells = 10;

  beforeEach(() => {
    sim = new LifeSphereSim({
      latCells,
      lonCells,
      planetRadius: 10,
      cellLift: 0,
      rules: GOL_RULES,
    });
    sim.setGameMode('Colony');
  });

  it('should handle survival rules', () => {
    // 2 neighbors -> survive
    sim.setCell(1, 1, 1); // Center A
    sim.setCell(0, 1, 1); // Top A
    sim.setCell(2, 1, 1); // Bottom A

    // 3 neighbors -> survive
    sim.setCell(5, 5, 2); // Center B
    sim.setCell(4, 5, 1); // Top A
    sim.setCell(6, 5, 2); // Bottom B
    sim.setCell(5, 4, 2); // Left B

    // 1 neighbor -> die
    sim.setCell(8, 8, 1); // Center A
    sim.setCell(8, 9, 1); // Right A

    sim.step();

    expect(sim.getCell(1, 1)).toBe(1); // Survived
    expect(sim.getCell(5, 5)).toBe(2); // Survived
    expect(sim.getCell(8, 8)).toBe(0); // Died
  });

  it('should handle birth rules', () => {
    // 3 neighbors (2 A, 1 B) -> Birth A
    // . A .
    // B . .
    // . A .
    sim.setCell(0, 1, 1);
    sim.setCell(1, 0, 2);
    sim.setCell(2, 1, 1);
    // Center at 1,1 should be born

    // 3 neighbors (1 A, 2 B) -> Birth B
    // . A .
    // B . .
    // . B .
    sim.setCell(5, 6, 1);
    sim.setCell(6, 5, 2);
    sim.setCell(7, 6, 2);
    // Center at 6,6 should be born

    sim.step();

    expect(sim.getCell(1, 1)).toBe(1); // Majority A
    expect(sim.getCell(6, 6)).toBe(2); // Majority B
  });

  it('should handle wrapping logic correctly in Colony mode', () => {
    // Test left/right wrapping
    // Place 3 neighbors across the seam to cause a birth at (5, 0)
    // (5, 0) neighbors: (5, lon-1), (4, 0), (6, 0)

    sim.setCell(5, lonCells - 1, 1); // Left of (5,0)
    sim.setCell(4, 0, 1); // Top of (5,0)
    sim.setCell(6, 0, 1); // Bottom of (5,0)

    sim.step();

    expect(sim.getCell(5, 0)).toBe(1);
  });
});
