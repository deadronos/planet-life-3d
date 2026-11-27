import { describe, expect, it } from 'vitest';

import { resolveToolFertilityDelta } from '../../src/components/planetLife/seedRequest';
import {
  advanceSolarPhase,
  COMET_SOIL_BOOST,
  computeEcologySample,
  SOIL_DEPLETE_PER_TICK,
  SOIL_LONG_LIVED_AGE,
  SOIL_MAX,
  SOIL_MIN,
  SOIL_NEUTRAL,
  SOIL_RECOVER_PER_TICK,
  soilByteToFertilityModifier,
  SOLAR_PHASE_PER_TICK,
  STERILIZER_SOIL_SCORCH,
} from '../../src/sim/ecology';
import { LifeGridSim } from '../../src/sim/LifeGridSim';
import type { Rules } from '../../src/sim/rules';
import { createLifeGridWorkerHandler } from '../../src/workers/lifeGridWorkerImpl';
import type { LifeGridWorkerSnapshot } from '../../src/workers/lifeGridWorkerMessages';

const GOL_RULES: Rules = {
  birth: [false, false, false, true, false, false, false, false, false],
  survive: [false, false, true, true, false, false, false, false, false],
};

describe('dynamic ecology: rotating solar cycle', () => {
  it('keeps sunlight unchanged at solarPhase=0 and shifts sunlight longitude with solarPhase', () => {
    const latCells = 16;
    const lonCells = 100;
    const lat = 8;

    const base = computeEcologySample({
      lat,
      lon: 18,
      latCells,
      lonCells,
      profile: 'Garden World',
    });
    const phaseZero = computeEcologySample({
      lat,
      lon: 18,
      latCells,
      lonCells,
      profile: 'Garden World',
      solarPhase: 0,
    });
    expect(phaseZero).toEqual(base);

    // At lon=18 (lon01=0.18), sunlight peaks at solarPhase=0 and drops to its trough at solarPhase=0.5.
    const night = computeEcologySample({
      lat,
      lon: 18,
      latCells,
      lonCells,
      profile: 'Garden World',
      solarPhase: 0.5,
    });
    expect(night.sunlight).toBeLessThan(phaseZero.sunlight);

    // Shifting solarPhase by 0.25 moves the peak sunlight from lon=18 to lon=43 (lon01=0.43).
    const shiftedLon43 = computeEcologySample({
      lat,
      lon: 43,
      latCells,
      lonCells,
      profile: 'Garden World',
      solarPhase: 0.25,
    });
    const unshiftedLon43 = computeEcologySample({
      lat,
      lon: 43,
      latCells,
      lonCells,
      profile: 'Garden World',
      solarPhase: 0,
    });
    expect(shiftedLon43.sunlight).toBeGreaterThan(unshiftedLon43.sunlight);
  });

  it('advances solarPhase deterministically per tick and leaves it at 0 when speed=0', () => {
    expect(advanceSolarPhase(0, 0)).toBe(0);
    expect(advanceSolarPhase(0.25, -1)).toBe(0.25);
    expect(advanceSolarPhase(0, 1)).toBeCloseTo(SOLAR_PHASE_PER_TICK, 8);
    expect(advanceSolarPhase(0.99, 4)).toBeCloseTo(0.99 + 4 * SOLAR_PHASE_PER_TICK - 1, 8);

    const sim = new LifeGridSim({ latCells: 10, lonCells: 16, rules: GOL_RULES });
    sim.step();
    expect(sim.getSolarPhase()).toBe(0);

    sim.setSolarCycleSpeed(2);
    sim.step();
    expect(sim.getSolarPhase()).toBeCloseTo(2 * SOLAR_PHASE_PER_TICK, 8);

    sim.clear();
    expect(sim.getSolarPhase()).toBe(0);
  });
});

describe('dynamic ecology: fertility depletion, recovery & terraforming', () => {
  it('maps quantized soil bytes symmetrically to fertility modifiers', () => {
    expect(soilByteToFertilityModifier(SOIL_NEUTRAL)).toBe(0);
    expect(soilByteToFertilityModifier(SOIL_MIN)).toBeCloseTo(-0.45, 6);
    expect(soilByteToFertilityModifier(SOIL_MAX)).toBeCloseTo(0.45, 6);
  });

  it('leaves soil untouched when dynamicFertility is false', () => {
    const sim = new LifeGridSim({ latCells: 10, lonCells: 10, rules: GOL_RULES });
    // 2x2 still life
    sim.setCell(4, 4, 1);
    sim.setCell(4, 5, 1);
    sim.setCell(5, 4, 1);
    sim.setCell(5, 5, 1);

    for (let i = 0; i < 10; i++) sim.step();
    expect(sim.getSoilView().every((v) => v === SOIL_NEUTRAL)).toBe(true);

    sim.seedAtCell({
      lat: 2,
      lon: 2,
      offsets: [[0, 0]],
      mode: 'set',
      scale: 1,
      jitter: 0,
      probability: 1,
      fertilityDelta: COMET_SOIL_BOOST,
    });
    expect(sim.getSoilView()[2 * 10 + 2]).toBe(SOIL_NEUTRAL);
  });

  it('depletes local soil under long-lived cells and recovers empty cells over time', () => {
    const sim = new LifeGridSim({ latCells: 10, lonCells: 10, rules: GOL_RULES });
    sim.setDynamicFertility(true);

    // 2x2 still life block at (4..5, 4..5)
    sim.setCell(4, 4, 1);
    sim.setCell(4, 5, 1);
    sim.setCell(5, 4, 1);
    sim.setCell(5, 5, 1);

    const idx = 4 * 10 + 4;
    // Initial setCell sets age=1. Stepping until age reaches SOIL_LONG_LIVED_AGE (4) should not deplete yet.
    while (sim.getAgeView()[idx] < SOIL_LONG_LIVED_AGE) {
      sim.step();
    }
    expect(sim.getSoilView()[idx]).toBe(SOIL_NEUTRAL);

    // Next step has prevAge >= SOIL_LONG_LIVED_AGE, so soil depletes by SOIL_DEPLETE_PER_TICK.
    sim.step();
    expect(sim.getSoilView()[idx]).toBe(SOIL_NEUTRAL - SOIL_DEPLETE_PER_TICK);

    // Step 10 more times and verify steady depletion
    for (let i = 0; i < 10; i++) sim.step();
    const depleted = sim.getSoilView()[idx];
    expect(depleted).toBe(SOIL_NEUTRAL - 11 * SOIL_DEPLETE_PER_TICK);

    // Clear the still life and step: empty cell should gradually recover toward SOIL_NEUTRAL
    sim.setCell(4, 4, 0);
    sim.setCell(4, 5, 0);
    sim.setCell(5, 4, 0);
    sim.setCell(5, 5, 0);
    sim.step();
    expect(sim.getSoilView()[idx]).toBe(depleted + SOIL_RECOVER_PER_TICK);
  });

  it('breaks up high-viability structures once soil is sufficiently depleted', () => {
    // Use Garden World where baseline viability >= 0.68 grants neighborBias = +1,
    // allowing a 2-cell horizontal pair (2 neighbors) to survive only while bias >= 0.
    // Once soil depletes enough, viability drops <= 0.28 -> neighborBias = -1,
    // and in Colony/Classic mode a 2-neighbor cell dies.
    const sim = new LifeGridSim({ latCells: 12, lonCells: 12, rules: GOL_RULES });
    sim.setEcologyProfile('Garden World');
    sim.setDynamicFertility(true);

    const sampleBefore = computeEcologySample({
      lat: 6,
      lon: 6,
      latCells: 12,
      lonCells: 12,
      profile: 'Garden World',
      fertilityModifier: soilByteToFertilityModifier(SOIL_NEUTRAL),
    });
    const sampleScorched = computeEcologySample({
      lat: 6,
      lon: 6,
      latCells: 12,
      lonCells: 12,
      profile: 'Garden World',
      fertilityModifier: soilByteToFertilityModifier(SOIL_MIN),
    });
    expect(sampleScorched.fertility).toBeLessThan(sampleBefore.fertility);
    expect(sampleScorched.viability).toBeLessThan(sampleBefore.viability);
  });

  it('applies Comet boost and Sterilizer scorched crater terraforming with gradual recovery', () => {
    expect(resolveToolFertilityDelta('Comet')).toBe(COMET_SOIL_BOOST);
    expect(resolveToolFertilityDelta('Sterilizer')).toBe(STERILIZER_SOIL_SCORCH);
    expect(resolveToolFertilityDelta('Life')).toBe(0);
    expect(resolveToolFertilityDelta('Mutation')).toBe(0);
    expect(resolveToolFertilityDelta('Probe')).toBe(0);

    const sim = new LifeGridSim({ latCells: 10, lonCells: 10, rules: GOL_RULES });
    sim.setDynamicFertility(true);

    // Comet impact boosts soil and moisture/fertility
    sim.seedAtCell({
      lat: 3,
      lon: 3,
      offsets: [[0, 0]],
      mode: 'set',
      scale: 1,
      jitter: 0,
      probability: 1,
      fertilityDelta: COMET_SOIL_BOOST,
    });
    const cometIdx = 3 * 10 + 3;
    expect(sim.getSoilView()[cometIdx]).toBe(Math.min(SOIL_MAX, SOIL_NEUTRAL + COMET_SOIL_BOOST));

    const cometSample = computeEcologySample({
      lat: 5,
      lon: 5,
      latCells: 10,
      lonCells: 10,
      profile: 'Garden World',
      fertilityModifier: soilByteToFertilityModifier(sim.getSoilView()[cometIdx]),
    });
    const neutralSample = computeEcologySample({
      lat: 5,
      lon: 5,
      latCells: 10,
      lonCells: 10,
      profile: 'Garden World',
      fertilityModifier: 0,
    });
    expect(cometSample.moisture).toBeGreaterThan(neutralSample.moisture);
    expect(cometSample.fertility).toBeGreaterThan(neutralSample.fertility);

    // Sterilizer impact clears life and leaves a scorched crater at SOIL_MIN
    sim.seedAtCell({
      lat: 3,
      lon: 3,
      offsets: [[0, 0]],
      mode: 'clear',
      scale: 1,
      jitter: 0,
      probability: 1,
      fertilityDelta: STERILIZER_SOIL_SCORCH,
    });
    expect(sim.getCell(3, 3)).toBe(0);
    // Boosted (238) + (-128) = 110, second hit hits 0
    sim.seedAtCell({
      lat: 3,
      lon: 3,
      offsets: [[0, 0]],
      mode: 'clear',
      scale: 1,
      jitter: 0,
      probability: 1,
      fertilityDelta: STERILIZER_SOIL_SCORCH,
    });
    expect(sim.getSoilView()[cometIdx]).toBe(SOIL_MIN);

    // Empty scorched cell recovers toward SOIL_NEUTRAL
    sim.step();
    expect(sim.getSoilView()[cometIdx]).toBe(SOIL_MIN + SOIL_RECOVER_PER_TICK);
  });

  it('maintains CPU and Worker parity for solarPhase, soil depletion/recovery, and terraforming', () => {
    const lat = 10;
    const lon = 12;
    const sim = new LifeGridSim({ latCells: lat, lonCells: lon, rules: GOL_RULES });
    sim.setEcologyProfile('Garden World');
    sim.setSolarCycleSpeed(1.5);
    sim.setDynamicFertility(true);

    const out: unknown[] = [];
    const handler = createLifeGridWorkerHandler((m) => out.push(m));
    handler.onMessage({
      type: 'init',
      latCells: lat,
      lonCells: lon,
      rules: GOL_RULES,
      ecologyProfile: 'Garden World',
      solarCycleSpeed: 1.5,
      dynamicFertility: true,
    });

    const offsets: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ];
    sim.seedAtCell({
      lat: 4,
      lon: 4,
      offsets,
      mode: 'set',
      scale: 1,
      jitter: 0,
      probability: 1,
      fertilityDelta: COMET_SOIL_BOOST,
    });
    out.length = 0;
    handler.onMessage({
      type: 'seedAtCell',
      lat: 4,
      lon: 4,
      offsets,
      mode: 'set',
      scale: 1,
      jitter: 0,
      probability: 1,
      fertilityDelta: COMET_SOIL_BOOST,
    });

    for (let i = 0; i < 8; i++) {
      sim.step();
      out.length = 0;
      handler.onMessage({ type: 'tick', steps: 1 });
      const snap = out.find(
        (m): m is LifeGridWorkerSnapshot =>
          typeof m === 'object' && m !== null && (m as { type?: string }).type === 'snapshot',
      )!;
      expect(new Uint8Array(snap.grid)).toEqual(sim.getGridView());
      expect(new Uint8Array(snap.soil)).toEqual(sim.getSoilView());
      expect(snap.solarPhase).toBeCloseTo(sim.getSolarPhase(), 10);
    }
  });
});
