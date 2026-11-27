import { beforeEach, describe, expect, it } from 'vitest';

import { computeEcologySample, type EcologyProfileName } from '../../src/sim/ecology';
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

  describe('stepColony rule adherence', () => {
    // Regression: stepColony previously hardcoded B3/S23 and ignored this.rules,
    // so presets like "Crystal Plague" (survive=234) silently ran S23.
    it('respects non-default survive rules (survive=234 keeps a 4-neighbor cell alive)', () => {
      const sim234 = new LifeGridSimColony({
        latCells,
        lonCells,
        rules: {
          birth: [false, false, false, true, false, false, false, false, false],
          survive: [false, false, true, true, true, false, false, false, false], // 234
        },
      });
      sim234.setGameMode('Colony');

      sim234.setCell(5, 5, 1);
      sim234.setCell(5, 4, 1);
      sim234.setCell(5, 6, 1);
      sim234.setCell(4, 5, 1);
      sim234.setCell(6, 5, 1); // 4 neighbors -> would die under S23

      sim234.stepColony();

      expect(sim234.getCell(5, 5)).toBe(1);
    });

    it('respects non-default birth rules (birth=2 births a cell with 2 neighbors)', () => {
      const simB2 = new LifeGridSimColony({
        latCells,
        lonCells,
        rules: {
          birth: [false, false, true, false, false, false, false, false, false], // B2
          survive: [false, false, true, true, false, false, false, false, false],
        },
      });
      simB2.setGameMode('Colony');

      simB2.setCell(5, 4, 1);
      simB2.setCell(5, 6, 1); // 2 type-1 neighbors -> no birth under B3

      simB2.stepColony();

      expect(simB2.getCell(5, 5)).toBe(1); // countA=2 -> Colony A
    });
  });

  describe('polarWrap topology', () => {
    it('births and sustains polar cells via antipodal neighbors when polarWrap is enabled', () => {
      const runWith = (polarWrap: boolean) => {
        const s = new LifeGridSimColony({ latCells, lonCells, rules: COLONY_RULES, polarWrap });
        s.setGameMode('Colony');
        // lat=0, lon=1: 2 Colony A antipodal neighbors at (0, 5), (0, 7) + 1 Colony B at (1, 1) -> Colony A birth
        s.setCell(0, 5, 1);
        s.setCell(0, 7, 1);
        s.setCell(1, 1, 2);

        // lat=latCells-1, lon=2: Colony B cell survives with 2 antipodal neighbors (9, 6), (9, 8)
        s.setCell(latCells - 1, 2, 2);
        s.setCell(latCells - 1, 6, 1);
        s.setCell(latCells - 1, 8, 2);

        s.stepColony();
        return {
          northBirth: s.getCell(0, 1),
          southSurvive: s.getCell(latCells - 1, 2),
        };
      };

      expect(runWith(false)).toEqual({ northBirth: 0, southSurvive: 0 });
      expect(runWith(true)).toEqual({ northBirth: 1, southSurvive: 2 });
    });
  });

  describe('birth symmetry and tie-breaking', () => {
    const HIGHLIFE_RULES: Rules = {
      birth: [false, false, false, true, false, false, true, false, false], // B36
      survive: [false, false, true, true, false, false, false, false, false], // S23
    };

    it('uses majority-wins under B36 (2 A + 4 B births Colony B, 4 A + 2 B births Colony A)', () => {
      const hlSim = new LifeGridSimColony({ latCells, lonCells, rules: HIGHLIFE_RULES });
      hlSim.setGameMode('Colony');

      // Target (5, 5): 2 Colony A + 4 Colony B neighbors -> Colony B must win
      hlSim.setCell(4, 4, 1);
      hlSim.setCell(4, 5, 1);
      hlSim.setCell(4, 6, 2);
      hlSim.setCell(5, 4, 2);
      hlSim.setCell(5, 6, 2);
      hlSim.setCell(6, 4, 2);

      hlSim.stepColony();
      expect(hlSim.getCell(5, 5)).toBe(2);

      // Symmetric case: 4 Colony A + 2 Colony B neighbors -> Colony A must win
      hlSim.clear();
      hlSim.setCell(4, 4, 2);
      hlSim.setCell(4, 5, 2);
      hlSim.setCell(4, 6, 1);
      hlSim.setCell(5, 4, 1);
      hlSim.setCell(5, 6, 1);
      hlSim.setCell(6, 4, 1);

      hlSim.stepColony();
      expect(hlSim.getCell(5, 5)).toBe(1);
    });

    it('breaks 3 A + 3 B ties under B36 deterministically using (lat + lon + generation) & 1', () => {
      const hlSim = new LifeGridSimColony({ latCells: 12, lonCells: 12, rules: HIGHLIFE_RULES });
      hlSim.setGameMode('Colony');

      // Cell (5, 5): 5 + 5 + 0 = 10 (even) -> Colony A
      const seed3A3B = (la: number, lo: number) => {
        hlSim.setCell(la - 1, lo - 1, 1);
        hlSim.setCell(la - 1, lo, 1);
        hlSim.setCell(la - 1, lo + 1, 1);
        hlSim.setCell(la + 1, lo - 1, 2);
        hlSim.setCell(la + 1, lo, 2);
        hlSim.setCell(la + 1, lo + 1, 2);
      };

      seed3A3B(5, 5);
      hlSim.stepColony();
      expect(hlSim.getCell(5, 5)).toBe(1); // (5 + 5 + 0) & 1 === 0 -> A

      // Adjacent cell (5, 6) at gen 0: (5 + 6 + 0) & 1 === 1 -> Colony B
      hlSim.clear();
      seed3A3B(5, 6);
      hlSim.stepColony();
      expect(hlSim.getCell(5, 6)).toBe(2);

      // Cell (5, 5) at gen 1: advance one empty step first so generation === 1
      hlSim.clear();
      hlSim.stepColony();
      expect(hlSim.generation).toBe(1);
      seed3A3B(5, 5);
      hlSim.stepColony();
      expect(hlSim.getCell(5, 5)).toBe(2); // (5 + 5 + 1) & 1 === 1 -> B
    });

    it('breaks 1 A + 1 B ties symmetrically under ecology +1 bias', () => {
      const profile: EcologyProfileName = 'Garden World';
      const L = 16;
      const W = 16;
      let evenCell: { lat: number; lon: number } | undefined;
      let oddCell: { lat: number; lon: number } | undefined;

      for (let lat = 2; lat < L - 2; lat++) {
        for (let lon = 2; lon < W - 2; lon++) {
          const sample = computeEcologySample({ lat, lon, latCells: L, lonCells: W, profile });
          if (sample.neighborBias === 1) {
            if (((lat + lon) & 1) === 0 && !evenCell) evenCell = { lat, lon };
            if (((lat + lon) & 1) === 1 && !oddCell) oddCell = { lat, lon };
          }
        }
      }

      expect(evenCell).toBeDefined();
      expect(oddCell).toBeDefined();
      if (!evenCell || !oddCell) return;

      const ecoSim = new LifeGridSimColony({ latCells: L, lonCells: W, rules: COLONY_RULES });
      ecoSim.setGameMode('Colony');
      ecoSim.setEcologyProfile(profile);

      // Place 1 A + 1 B around evenCell -> parity 0 -> Colony A
      ecoSim.setCell(evenCell.lat, evenCell.lon - 1, 1);
      ecoSim.setCell(evenCell.lat, evenCell.lon + 1, 2);
      ecoSim.stepColony();
      expect(ecoSim.getCell(evenCell.lat, evenCell.lon)).toBe(1);

      // Place 1 A + 1 B around oddCell -> parity 1 -> Colony B
      ecoSim.clear();
      ecoSim.setCell(oddCell.lat, oddCell.lon - 1, 1);
      ecoSim.setCell(oddCell.lat, oddCell.lon + 1, 2);
      ecoSim.stepColony();
      expect(ecoSim.getCell(oddCell.lat, oddCell.lon)).toBe(2);
    });

    it('treats Colony A and B symmetrically when non-tied populations are swapped', () => {
      const stepSwapped = (aVal: 1 | 2, bVal: 1 | 2) => {
        const s = new LifeGridSimColony({ latCells: 12, lonCells: 12, rules: HIGHLIFE_RULES });
        s.setGameMode('Colony');
        // Non-tied B3 (2 vs 1) and B6 (4 vs 2)
        s.setCell(2, 2, aVal);
        s.setCell(2, 4, aVal);
        s.setCell(4, 3, bVal);

        s.setCell(7, 7, aVal);
        s.setCell(7, 8, aVal);
        s.setCell(7, 9, aVal);
        s.setCell(8, 7, aVal);
        s.setCell(8, 9, bVal);
        s.setCell(9, 7, bVal);

        s.stepColony();
        return { b3: s.getCell(3, 3), b6: s.getCell(8, 8) };
      };

      const ab = stepSwapped(1, 2);
      const ba = stepSwapped(2, 1);
      expect(ab).toEqual({ b3: 1, b6: 1 });
      expect(ba).toEqual({ b3: 2, b6: 2 });
    });
  });

  describe('colonyBiomeAffinity', () => {
    const findCellWithSample = (
      L: number,
      W: number,
      profile: EcologyProfileName,
      predicate: (s: ReturnType<typeof computeEcologySample>, lat: number, lon: number) => boolean,
    ) => {
      for (let lat = 2; lat < L - 2; lat++) {
        for (let lon = 2; lon < W - 2; lon++) {
          const sample = computeEcologySample({ lat, lon, latCells: L, lonCells: W, profile });
          if (predicate(sample, lat, lon)) return { lat, lon, sample };
        }
      }
      return undefined;
    };

    it('favors Colony A in warm/wet lowlands and Colony B in cold/highland ridges when enabled', () => {
      const L = 32;
      const W = 64;
      const profile: EcologyProfileName = 'Crystal Plague';
      const warmLowland = findCellWithSample(
        L,
        W,
        profile,
        (s) => s.neighborBias === 0 && s.colonyAffinity === 1,
      );
      const coldRidge = findCellWithSample(
        L,
        W,
        profile,
        (s) => s.neighborBias === 0 && s.colonyAffinity === -1,
      );

      expect(warmLowland).toBeDefined();
      expect(coldRidge).toBeDefined();
      if (!warmLowland || !coldRidge) return;

      // With biome affinity disabled, neither 2-neighbor group births when neighborBias === 0
      const offSim = new LifeGridSimColony({ latCells: L, lonCells: W, rules: COLONY_RULES });
      offSim.setGameMode('Colony');
      offSim.setEcologyProfile(profile);
      offSim.setColonyBiomeAffinity(false);
      offSim.setCell(warmLowland.lat, warmLowland.lon - 1, 1);
      offSim.setCell(warmLowland.lat, warmLowland.lon + 1, 1);
      offSim.setCell(coldRidge.lat, coldRidge.lon - 1, 2);
      offSim.setCell(coldRidge.lat, coldRidge.lon + 1, 2);
      offSim.stepColony();
      expect(offSim.getCell(warmLowland.lat, warmLowland.lon)).toBe(0);
      expect(offSim.getCell(coldRidge.lat, coldRidge.lon)).toBe(0);

      // With biome affinity enabled:
      // - Warm/wet lowland: 2 Colony A neighbors birth A; 3 Colony B neighbors fail to birth B
      // - Cold/highland ridge: 2 Colony B neighbors birth B; 3 Colony A neighbors fail to birth A
      const onSim = new LifeGridSimColony({ latCells: L, lonCells: W, rules: COLONY_RULES });
      onSim.setGameMode('Colony');
      onSim.setEcologyProfile(profile);
      onSim.setColonyBiomeAffinity(true);

      onSim.setCell(warmLowland.lat, warmLowland.lon - 1, 1);
      onSim.setCell(warmLowland.lat, warmLowland.lon + 1, 1);
      onSim.setCell(coldRidge.lat, coldRidge.lon - 1, 2);
      onSim.setCell(coldRidge.lat, coldRidge.lon + 1, 2);
      onSim.stepColony();
      expect(onSim.getCell(warmLowland.lat, warmLowland.lon)).toBe(1);
      expect(onSim.getCell(coldRidge.lat, coldRidge.lon)).toBe(2);

      // Disfavored species is penalized: 3 Colony B in warm lowland -> 3-1=2 -> no birth
      // 3 Colony A in cold ridge -> 3-1=2 -> no birth
      onSim.clear();
      onSim.setCell(warmLowland.lat, warmLowland.lon - 1, 2);
      onSim.setCell(warmLowland.lat, warmLowland.lon + 1, 2);
      onSim.setCell(warmLowland.lat - 1, warmLowland.lon, 2);
      onSim.setCell(coldRidge.lat, coldRidge.lon - 1, 1);
      onSim.setCell(coldRidge.lat, coldRidge.lon + 1, 1);
      onSim.setCell(coldRidge.lat - 1, coldRidge.lon, 1);
      onSim.stepColony();
      expect(onSim.getCell(warmLowland.lat, warmLowland.lon)).toBe(0);
      expect(onSim.getCell(coldRidge.lat, coldRidge.lon)).toBe(0);
    });

    it('breaks 1 A + 1 B ties toward the biome-favored species and stays inactive when Ecology is None', () => {
      const L = 32;
      const W = 64;
      const profile: EcologyProfileName = 'Crystal Plague';
      // Pick an odd-parity warmLowland so parity alone would pick B, proving affinity wins
      const warmLowlandOdd = findCellWithSample(
        L,
        W,
        profile,
        (s, lat, lon) => s.neighborBias === 0 && s.colonyAffinity === 1 && ((lat + lon) & 1) === 1,
      );
      expect(warmLowlandOdd).toBeDefined();
      if (!warmLowlandOdd) return;

      const simAffinity = new LifeGridSimColony({ latCells: L, lonCells: W, rules: COLONY_RULES });
      simAffinity.setGameMode('Colony');
      simAffinity.setEcologyProfile(profile);
      simAffinity.setColonyBiomeAffinity(true);
      simAffinity.setCell(warmLowlandOdd.lat, warmLowlandOdd.lon - 1, 1);
      simAffinity.setCell(warmLowlandOdd.lat, warmLowlandOdd.lon + 1, 2);
      simAffinity.stepColony();
      expect(simAffinity.getCell(warmLowlandOdd.lat, warmLowlandOdd.lon)).toBe(1);

      // When ecologyProfile is 'None', colonyBiomeAffinity has no effect
      simAffinity.clear();
      simAffinity.setEcologyProfile('None');
      simAffinity.setCell(warmLowlandOdd.lat, warmLowlandOdd.lon - 1, 1);
      simAffinity.setCell(warmLowlandOdd.lat, warmLowlandOdd.lon + 1, 2);
      simAffinity.stepColony();
      expect(simAffinity.getCell(warmLowlandOdd.lat, warmLowlandOdd.lon)).toBe(0);
    });
  });
});
