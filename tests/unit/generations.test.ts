import { describe, expect, it } from 'vitest';

import { LifeGridSim } from '../../src/sim/LifeGridSim';
import { LifeGridSimClassic } from '../../src/sim/LifeGridSimClassic';
import { RULE_PRESETS } from '../../src/sim/presets';
import {
  DEFAULT_DECAY_STATES,
  MAX_DECAY_STATES,
  MIN_DECAY_STATES,
  normalizeDecayStates,
  parseRuleDigits,
  type Rules,
} from '../../src/sim/rules';

function rulesFromPreset(name: string): Rules {
  const p = RULE_PRESETS[name];
  return {
    birth: parseRuleDigits(p.birth),
    survive: parseRuleDigits(p.survive),
    decayStates: p.decayStates,
  };
}

describe('Generations rules & presets', () => {
  it('normalizes decayStates into [2..16] with default 2', () => {
    expect(normalizeDecayStates(undefined)).toBe(DEFAULT_DECAY_STATES);
    expect(normalizeDecayStates(null)).toBe(DEFAULT_DECAY_STATES);
    expect(normalizeDecayStates(Number.NaN)).toBe(DEFAULT_DECAY_STATES);
    expect(normalizeDecayStates(1)).toBe(MIN_DECAY_STATES);
    expect(normalizeDecayStates(0)).toBe(MIN_DECAY_STATES);
    expect(normalizeDecayStates(2)).toBe(2);
    expect(normalizeDecayStates(4)).toBe(4);
    expect(normalizeDecayStates(16)).toBe(16);
    expect(normalizeDecayStates(99)).toBe(MAX_DECAY_STATES);
  });

  it("defines Brian's Brain (B2/S/G3) and Star Wars (B2/S345/G4) presets", () => {
    expect(RULE_PRESETS["Brian's Brain"]).toEqual({
      birth: '2',
      survive: '',
      decayStates: 3,
    });
    expect(RULE_PRESETS['Star Wars']).toEqual({
      birth: '2',
      survive: '345',
      decayStates: 4,
    });
    expect(RULE_PRESETS.Conway.decayStates).toBe(2);
  });

  describe("Brian's Brain (B2/S/G3)", () => {
    it('transitions firing -> refractory -> dead and births dead cells with 2 firing neighbors', () => {
      const sim = new LifeGridSimClassic({
        latCells: 10,
        lonCells: 10,
        rules: rulesFromPreset("Brian's Brain"),
      });

      // Two adjacent firing cells at (5,4) and (5,5):
      // - Both have only 1 firing neighbor, and survive is empty, so both -> state 2
      // - Dead cells (4,4), (4,5), (6,4), (6,5) each have 2 firing neighbors -> born into state 1
      sim.setCell(5, 4, 1);
      sim.setCell(5, 5, 1);

      sim.stepClassic();

      expect(sim.getCell(5, 4)).toBe(2);
      expect(sim.getCell(5, 5)).toBe(2);
      expect(sim.getCell(4, 4)).toBe(1);
      expect(sim.getCell(4, 5)).toBe(1);
      expect(sim.getCell(6, 4)).toBe(1);
      expect(sim.getCell(6, 5)).toBe(1);

      // Next tick: old (5,4) and (5,5) decay from 2 -> 0 (dead)
      // (4,4),(4,5),(6,4),(6,5) move from 1 -> 2
      sim.stepClassic();

      expect(sim.getCell(5, 4)).toBe(0);
      expect(sim.getCell(5, 5)).toBe(0);
      expect(sim.getCell(4, 4)).toBe(2);
      expect(sim.getCell(4, 5)).toBe(2);
      expect(sim.getCell(6, 4)).toBe(2);
      expect(sim.getCell(6, 5)).toBe(2);
    });

    it('ignores refractory cells when counting neighbors and never births into refractory cells', () => {
      const sim = new LifeGridSimClassic({
        latCells: 10,
        lonCells: 10,
        rules: rulesFromPreset("Brian's Brain"),
      });

      // Target cell (5,5) is dead; neighbors: one firing (5,4)=1, one refractory (5,6)=2
      sim.setCell(5, 4, 1);
      sim.setCell(5, 6, 2);

      // Refractory cell (3,5)=2 has two firing neighbors (3,4)=1 and (3,6)=1
      sim.setCell(3, 5, 2);
      sim.setCell(3, 4, 1);
      sim.setCell(3, 6, 1);

      sim.stepClassic();

      // (5,5) only had 1 firing neighbor, so it must stay dead (0)
      expect(sim.getCell(5, 5)).toBe(0);
      // (3,5) was refractory (2), so it advances to dead (0) instead of being born
      expect(sim.getCell(3, 5)).toBe(0);
    });
  });

  describe('Star Wars (B2/S345/G4)', () => {
    it('survives on 3-5 firing neighbors, decays 1->2->3->0 otherwise, and ignores refractory neighbors', () => {
      const sim = new LifeGridSimClassic({
        latCells: 12,
        lonCells: 12,
        rules: rulesFromPreset('Star Wars'),
      });

      // Firing cell (5,5) with 3 firing neighbors survives (state 1 -> 1)
      sim.setCell(5, 5, 1);
      sim.setCell(4, 5, 1);
      sim.setCell(5, 4, 1);
      sim.setCell(6, 5, 1);

      // Firing cell (9,9) with 0 firing neighbors (and 3 refractory neighbors!) must NOT survive
      sim.setCell(9, 9, 1);
      sim.setCell(8, 9, 2);
      sim.setCell(9, 8, 2);
      sim.setCell(10, 9, 3);

      sim.stepClassic();

      expect(sim.getCell(5, 5)).toBe(1);
      // (9,9) entered state 2 because refractory neighbors don't count for survival
      expect(sim.getCell(9, 9)).toBe(2);
      expect(sim.getCell(8, 9)).toBe(3);
      expect(sim.getCell(9, 8)).toBe(3);
      expect(sim.getCell(10, 9)).toBe(0);

      // Step twice more to verify (9,9) progresses 2 -> 3 -> 0
      sim.stepClassic();
      expect(sim.getCell(9, 9)).toBe(3);

      sim.stepClassic();
      expect(sim.getCell(9, 9)).toBe(0);
    });

    it('keeps aliveIndices and population in sync across refractory decay and births/deaths', () => {
      const sim = new LifeGridSim({
        latCells: 10,
        lonCells: 10,
        rules: rulesFromPreset('Star Wars'),
      });

      sim.setCell(5, 5, 1);
      expect(sim.population).toBe(1);

      // Tick 1: 1 -> 2 (still in grid as refractory, 0 births, 0 deaths)
      sim.step();
      expect(sim.getCell(5, 5)).toBe(2);
      expect(sim.population).toBe(1);
      expect(sim.getAliveCount()).toBe(1);
      expect(sim.deathsLastTick).toBe(0);

      // Tick 2: 2 -> 3
      sim.step();
      expect(sim.getCell(5, 5)).toBe(3);
      expect(sim.population).toBe(1);
      expect(sim.deathsLastTick).toBe(0);

      // Tick 3: 3 -> 0 (now dies)
      sim.step();
      expect(sim.getCell(5, 5)).toBe(0);
      expect(sim.population).toBe(0);
      expect(sim.getAliveCount()).toBe(0);
      expect(sim.deathsLastTick).toBe(1);
    });
  });

  describe('Backward compatibility & mode transitions', () => {
    it('behaves identically to classic binary Life when decayStates === 2', () => {
      const classicDefault = new LifeGridSimClassic({
        latCells: 10,
        lonCells: 10,
        rules: { birth: parseRuleDigits('3'), survive: parseRuleDigits('23') },
      });
      const explicitG2 = new LifeGridSimClassic({
        latCells: 10,
        lonCells: 10,
        rules: { birth: parseRuleDigits('3'), survive: parseRuleDigits('23'), decayStates: 2 },
      });

      const coords: [number, number][] = [
        [4, 5],
        [5, 6],
        [6, 4],
        [6, 5],
        [6, 6],
      ];
      for (const [la, lo] of coords) {
        classicDefault.setCell(la, lo, 1);
        explicitG2.setCell(la, lo, 1);
      }

      for (let t = 0; t < 10; t++) {
        classicDefault.stepClassic();
        explicitG2.stepClassic();
        expect(explicitG2.getGridView()).toEqual(classicDefault.getGridView());
        expect(explicitG2.population).toBe(classicDefault.population);
        expect(explicitG2.birthsLastTick).toBe(classicDefault.birthsLastTick);
        expect(explicitG2.deathsLastTick).toBe(classicDefault.deathsLastTick);
      }
    });

    it('clears out-of-range refractory cells when switching back to G=2 in Classic mode', () => {
      const sim = new LifeGridSim({
        latCells: 10,
        lonCells: 10,
        rules: rulesFromPreset('Star Wars'),
      });

      sim.setCell(4, 4, 1);
      sim.setCell(4, 5, 2);
      sim.setCell(5, 4, 3);
      expect(sim.population).toBe(3);

      // Switching back to Conway (G=2) clears states >= 2 to 0
      sim.setRules(rulesFromPreset('Conway'));
      expect(sim.getCell(4, 4)).toBe(1);
      expect(sim.getCell(4, 5)).toBe(0);
      expect(sim.getCell(5, 4)).toBe(0);
      expect(sim.population).toBe(1);
      expect(sim.getAliveCount()).toBe(1);
    });

    it('preserves refractory cells when setGameMode("Classic") is called idempotently', () => {
      const sim = new LifeGridSim({
        latCells: 10,
        lonCells: 10,
        rules: rulesFromPreset('Star Wars'),
      });
      sim.setCell(5, 5, 3);
      sim.setGameMode('Classic');
      expect(sim.getCell(5, 5)).toBe(3);
    });
  });
});
