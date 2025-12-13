import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { LifeSphereSim, parseRuleDigits } from '../src/sim/LifeSphereSim';

describe('LifeSphereSim', () => {
  it('maps north/south poles correctly with pointToCell', () => {
    const latCells = 9;
    const lonCells = 9;
    const sim = new LifeSphereSim({
      latCells,
      lonCells,
      planetRadius: 1,
      cellLift: 0,
      rules: { birth: parseRuleDigits('3'), survive: parseRuleDigits('23') },
    });

    let p = new THREE.Vector3(0, 1, 0);
    let c = sim.pointToCell(p);
    expect(c.lat).toBe(latCells - 1);

    p = new THREE.Vector3(0, -1, 0);
    c = sim.pointToCell(p);
    expect(c.lat).toBe(0);
  });

  it('applies blinker oscillator correctly', () => {
    const latCells = 5;
    const lonCells = 5;
    const sim = new LifeSphereSim({
      latCells,
      lonCells,
      planetRadius: 1,
      cellLift: 0,
      rules: { birth: parseRuleDigits('3'), survive: parseRuleDigits('23') },
    });

    // Blinker: horizontal three cells
    sim.clear();
    sim.setCell(2, 1, 1);
    sim.setCell(2, 2, 1);
    sim.setCell(2, 3, 1);

    sim.step();

    // After one step, expect a vertical orientation centered at (lat=2, lon=2)
    expect(sim.getCell(2, 2)).toBe(1);
    expect(sim.getCell(1, 2)).toBe(1);
    expect(sim.getCell(3, 2)).toBe(1);

    // And initial horizontal neighbors should be dead now
    expect(sim.getCell(2, 1)).toBe(0);
    expect(sim.getCell(2, 3)).toBe(0);
  });

  it('correctly positions cells based on planetRadius and cellLift', () => {
    const sim = new LifeSphereSim({
      latCells: 10,
      lonCells: 10,
      planetRadius: 5,
      cellLift: 0.1,
      rules: { birth: [], survive: [] },
    });

    // Check random cell position magnitude
    // It should be radius + lift = 5.1
    const p = sim.positions[0];
    expect(p.length()).toBeCloseTo(5.1, 4);

    // Check another cell
    const p2 = sim.positions[50];
    expect(p2.length()).toBeCloseTo(5.1, 4);
  });
});
