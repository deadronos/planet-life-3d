import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { LifeSphereSim, parseRuleDigits } from '../../src/sim/LifeSphereSim';
import type { Rules } from '../../src/sim/LifeSphereSim';
import type { Offset } from '../../src/sim/patterns';

// Standard Game of Life Rules: B3/S23
const GOL_RULES: Rules = {
  birth: [false, false, false, true, false, false, false, false, false], // 3
  survive: [false, false, true, true, false, false, false, false, false], // 2, 3
};

describe('LifeSphereSim', () => {
  describe('parseRuleDigits', () => {
    it('should parse "3" correctly for birth', () => {
      const res = parseRuleDigits('3');
      expect(res[3]).toBe(true);
      expect(res[2]).toBe(false);
    });

    it('should parse "23" correctly', () => {
      const res = parseRuleDigits('23');
      expect(res[2]).toBe(true);
      expect(res[3]).toBe(true);
      expect(res[4]).toBe(false);
    });

    it('should parse number inputs', () => {
      const res = parseRuleDigits(23);
      expect(res[2]).toBe(true);
      expect(res[3]).toBe(true);
    });

    it('should handle invalid inputs gracefully', () => {
      const res = parseRuleDigits('abc');
      expect(res.every((b) => b === false)).toBe(true);
      const res2 = parseRuleDigits(null);
      expect(res2.every((b) => b === false)).toBe(true);
    });
  });

  describe('Simulation Logic', () => {
    let sim: LifeSphereSim;
    const latCells = 10;
    const lonCells = 10;

    beforeEach(() => {
      sim = new LifeSphereSim({
        latCells,
        lonCells,
        planetRadius: 10,
        cellLift: 0.1,
        rules: GOL_RULES,
      });
    });

    it('should initialize grid with zeros', () => {
      sim.forEachAlive(() => {
        throw new Error('Grid should be empty');
      });
      const view = sim.getGridView();
      expect(view.every((v) => v === 0)).toBe(true);
    });

    it('should set and get cell correctly', () => {
      sim.setCell(2, 2, 1);
      expect(sim.getCell(2, 2)).toBe(1);
      expect(sim.getCell(2, 3)).toBe(0);
    });

    it('should wrap longitude correctly', () => {
      sim.setCell(2, lonCells, 1); // Should wrap to 0
      expect(sim.getCell(2, 0)).toBe(1);

      sim.setCell(2, -1, 1); // Should wrap to last
      expect(sim.getCell(2, lonCells - 1)).toBe(1);
    });

    it('should clamp latitude', () => {
      sim.setCell(-1, 0, 1);
      expect(sim.getCell(0, 0)).toBe(1);

      sim.setCell(latCells + 5, 0, 1);
      expect(sim.getCell(latCells - 1, 0)).toBe(1);
    });

    it('should clear grid', () => {
      sim.setCell(1, 1, 1);
      sim.clear();
      expect(sim.getCell(1, 1)).toBe(0);
    });

    it('should randomize grid', () => {
      // Mock Math.random to return < 0.5 (alive) and > 0.5 (dead)
      // but sim.randomize takes density.
      // If density is 1, all should be alive.
      sim.randomize(1);
      let count = 0;
      sim.forEachAlive(() => count++);
      expect(count).toBe(latCells * lonCells);

      sim.randomize(0);
      count = 0;
      sim.forEachAlive(() => count++);
      expect(count).toBe(0);
    });

    it('should execute step correctly (Blinker)', () => {
      // Blinker pattern
      // .O.
      // .O.
      // .O.
      // Becomes:
      // ...
      // OOO
      // ...
      const lat = 5;
      const lon = 5;
      sim.setCell(lat - 1, lon, 1);
      sim.setCell(lat, lon, 1);
      sim.setCell(lat + 1, lon, 1);

      sim.step();

      // Check center remains alive (2 neighbors: top and bottom) -> Wait.
      // Middle cell: neighbors are (lat-1, lon) and (lat+1, lon). Count = 2.
      // Rule S23: 2 is survive. So center stays 1.
      expect(sim.getCell(lat, lon)).toBe(1);

      // Check left/right (should be born)
      // (lat, lon-1): neighbors are (lat-1, lon), (lat, lon), (lat+1, lon). Count = 3.
      // Rule B3: 3 is birth. So it becomes 1.
      expect(sim.getCell(lat, lon - 1)).toBe(1);
      expect(sim.getCell(lat, lon + 1)).toBe(1);

      // Check top/bottom (should die)
      // (lat-1, lon): neighbors are (lat, lon). Count = 1. Dies.
      expect(sim.getCell(lat - 1, lon)).toBe(0);
      expect(sim.getCell(lat + 1, lon)).toBe(0);
    });

    it('should execute step correctly (Block - Still Life)', () => {
      // OO
      // OO
      const lat = 2;
      const lon = 2;
      sim.setCell(lat, lon, 1);
      sim.setCell(lat, lon + 1, 1);
      sim.setCell(lat + 1, lon, 1);
      sim.setCell(lat + 1, lon + 1, 1);

      sim.step();

      expect(sim.getCell(lat, lon)).toBe(1);
      expect(sim.getCell(lat, lon + 1)).toBe(1);
      expect(sim.getCell(lat + 1, lon)).toBe(1);
      expect(sim.getCell(lat + 1, lon + 1)).toBe(1);
    });
  });

  describe('Geometry and Seeding', () => {
    let sim: LifeSphereSim;

    beforeEach(() => {
      sim = new LifeSphereSim({
        latCells: 10,
        lonCells: 20,
        planetRadius: 10,
        cellLift: 0,
        rules: GOL_RULES,
      });
    });

    it('pointToCell should return valid coordinates', () => {
      // Point on equator (lat=0, so middle index), lon=0
      const point = new THREE.Vector3(10, 0, 0);
      // lat range is -pi/2 to pi/2. equator is 0.
      // In constructor: lat goes from 0 to latCells-1.
      // 0 corresponds to -pi/2 (bottom), latCells-1 to pi/2 (top).
      // Middle index should be equator.
      // latCells=10. Indices 0..9. 4.5 is middle. Math.round(4.5) could be 5.

      const { lat, lon } = sim.pointToCell(point);
      expect(lat).toBeGreaterThanOrEqual(0);
      expect(lat).toBeLessThan(10);
      expect(lon).toBeGreaterThanOrEqual(0);
      expect(lon).toBeLessThan(20);
    });

    it('seedAtCell should apply pattern', () => {
      const offsets = [
        [0, 0],
        [0, 1],
      ];
      sim.seedAtCell({
        lat: 5,
        lon: 5,
        offsets: offsets as Offset[],
        mode: 'set',
        scale: 1,
        jitter: 0,
        probability: 1,
      });

      expect(sim.getCell(5, 5)).toBe(1);
      expect(sim.getCell(5, 6)).toBe(1);
      expect(sim.getCell(5, 7)).toBe(0);
    });

    it('seedAtPoint should map point to cell and seed', () => {
      const offsets = [[0, 0]];
      const point = new THREE.Vector3(10, 0, 0);
      sim.seedAtPoint({
        point,
        offsets: offsets as Offset[],
        mode: 'set',
        scale: 1,
        jitter: 0,
        probability: 1,
      });

      // We don't know exact lat/lon without calculation, but we can check if *something* was set.
      let count = 0;
      sim.forEachAlive(() => count++);
      expect(count).toBe(1);
    });

    it('seedAtCell with mode "clear" should remove cells', () => {
      sim.setCell(5, 5, 1);
      sim.seedAtCell({
        lat: 5,
        lon: 5,
        offsets: [[0, 0]] as Offset[],
        mode: 'clear',
        scale: 1,
        jitter: 0,
        probability: 1,
      });
      expect(sim.getCell(5, 5)).toBe(0);
    });

    it('seedAtCell with mode "toggle" should flip cells', () => {
      sim.setCell(5, 5, 1);
      sim.seedAtCell({
        lat: 5,
        lon: 5,
        offsets: [[0, 0]] as Offset[],
        mode: 'toggle',
        scale: 1,
        jitter: 0,
        probability: 1,
      });
      expect(sim.getCell(5, 5)).toBe(0);

      sim.seedAtCell({
        lat: 5,
        lon: 5,
        offsets: [[0, 0]] as Offset[],
        mode: 'toggle',
        scale: 1,
        jitter: 0,
        probability: 1,
      });
      expect(sim.getCell(5, 5)).toBe(1);
    });

    it('seedAtCell with mode "random" should respect probability', () => {
      // Force random to always return 0 (success for < p)
      const alwaysHit = () => 0;
      sim.seedAtCell({
        lat: 5,
        lon: 5,
        offsets: [[0, 0]] as Offset[],
        mode: 'random',
        scale: 1,
        jitter: 0,
        probability: 0.5,
        rng: alwaysHit,
      });
      expect(sim.getCell(5, 5)).toBe(1);

      // Force random to always return 1 (fail for < p)
      const alwaysMiss = () => 1;
      sim.seedAtCell({
        lat: 5,
        lon: 6, // different cell
        offsets: [[0, 0]] as Offset[],
        mode: 'random',
        scale: 1,
        jitter: 0,
        probability: 0.5,
        rng: alwaysMiss,
      });
      expect(sim.getCell(5, 6)).toBe(0);
    });

    it('seedAtCell with jitter should disperse seeds', () => {
      // Mock rng to return distinct values to cause jitter
      let i = 0;
      const deterministicRng = () => {
        i++;
        return i % 2 === 0 ? 0.9 : 0.1; // Alternate high/low
      };

      sim.seedAtCell({
        lat: 5,
        lon: 5,
        offsets: [[0, 0]] as Offset[],
        mode: 'set',
        scale: 1,
        jitter: 2,
        probability: 1,
        rng: deterministicRng,
      });

      // With jitter, it shouldn't necessarily be at 5,5
      // but somewhere nearby.
      // We can check if ANY cell is alive in the vicinity.
      let count = 0;
      sim.forEachAlive(() => count++);
      expect(count).toBeGreaterThan(0);
    });
  });
});
