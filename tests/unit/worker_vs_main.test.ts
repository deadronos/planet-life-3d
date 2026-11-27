import { describe, expect, it } from 'vitest';

import { LifeGridSim } from '../../src/sim/LifeGridSim';
import { parseRuleDigits } from '../../src/sim/rules';
import { createLifeGridWorkerHandler } from '../../src/workers/lifeGridWorkerImpl';
import type { LifeGridWorkerSnapshot } from '../../src/workers/lifeGridWorkerMessages';

const GOL_RULES = {
  birth: parseRuleDigits('3'),
  survive: parseRuleDigits('23'),
};

function isSnapshot(m: unknown): m is LifeGridWorkerSnapshot {
  return typeof m === 'object' && m !== null && 'type' in m && m.type === 'snapshot';
}

function findSnapshot(out: unknown[]): LifeGridWorkerSnapshot | undefined {
  for (let i = out.length - 1; i >= 0; i--) {
    const m = out[i];
    if (isSnapshot(m)) return m;
  }
  return undefined;
}

describe('Worker vs main simulation equivalence', () => {
  it('seed and tick parity for a seeded pattern', () => {
    const lat = 8;
    const lon = 8;

    // main-thread sim
    const sim = new LifeGridSim({ latCells: lat, lonCells: lon, rules: GOL_RULES });

    // worker handler
    const out: unknown[] = [];
    const handler = createLifeGridWorkerHandler((m) => out.push(m));

    handler.onMessage({
      type: 'init',
      latCells: lat,
      lonCells: lon,
      rules: GOL_RULES,
    });

    const baseLat = 3;
    const baseLon = 4;
    const offsets: [number, number][] = [
      [0, 0],
      [0, 1],
      [0, -1],
    ];

    // Seed both
    sim.seedAtCell({
      lat: baseLat,
      lon: baseLon,
      offsets: offsets,
      mode: 'set',
      scale: 1,
      jitter: 0,
      probability: 1,
    });

    out.length = 0;
    handler.onMessage({
      type: 'seedAtCell',
      lat: baseLat,
      lon: baseLon,
      offsets,
      mode: 'set',
      scale: 1,
      jitter: 0,
      probability: 1,
    });

    const snap0 = findSnapshot(out);
    expect(snap0).toBeTruthy();
    expect(new Uint8Array(snap0!.grid)).toEqual(sim.getGridView());
    expect(new Uint8Array(snap0!.age)).toEqual(sim.getAgeView());
    expect(new Uint8Array(snap0!.heat)).toEqual(sim.getNeighborHeatView());

    // Run several steps and compare
    for (let i = 0; i < 5; i++) {
      sim.step();

      out.length = 0;
      handler.onMessage({ type: 'tick', steps: 1 });

      const snap = findSnapshot(out);
      expect(snap).toBeTruthy();
      expect(new Uint8Array(snap!.grid)).toEqual(sim.getGridView());
      expect(new Uint8Array(snap!.age)).toEqual(sim.getAgeView());
      expect(new Uint8Array(snap!.heat)).toEqual(sim.getNeighborHeatView());
      expect(snap!.generation).toBe(sim.generation);
      expect(snap!.population).toBe(sim.population);
    }
  });

  it('randomize edge cases (0 and 1) match between worker and main sim', () => {
    const lat = 6;
    const lon = 6;

    const sim = new LifeGridSim({ latCells: lat, lonCells: lon, rules: GOL_RULES });
    const out: unknown[] = [];
    const handler = createLifeGridWorkerHandler((m) => out.push(m));

    handler.onMessage({
      type: 'init',
      latCells: lat,
      lonCells: lon,
      rules: GOL_RULES,
    });

    // density = 1 (all alive)
    sim.randomize(1);
    out.length = 0;
    handler.onMessage({ type: 'randomize', density: 1 });
    const snap1 = findSnapshot(out)!;
    expect(snap1).toBeTruthy();
    expect(new Uint8Array(snap1.grid)).toEqual(sim.getGridView());

    // density = 0 (all dead)
    sim.randomize(0);
    out.length = 0;
    handler.onMessage({ type: 'randomize', density: 0 });
    const snap0 = findSnapshot(out)!;
    expect(snap0).toBeTruthy();
    expect(new Uint8Array(snap0.grid)).toEqual(sim.getGridView());
  });

  it('seeding across longitude boundary wraps equivalently', () => {
    const lat = 7;
    const lon = 7;
    const sim = new LifeGridSim({ latCells: lat, lonCells: lon, rules: GOL_RULES });
    const out: unknown[] = [];
    const handler = createLifeGridWorkerHandler((m) => out.push(m));
    handler.onMessage({
      type: 'init',
      latCells: lat,
      lonCells: lon,
      rules: GOL_RULES,
    });

    const baseLat = 2;
    const baseLon = lon - 1; // last column
    const offsets: [number, number][] = [[0, 1]]; // this should wrap to lon 0

    sim.seedAtCell({
      lat: baseLat,
      lon: baseLon,
      offsets: offsets,
      mode: 'set',
      scale: 1,
      jitter: 0,
      probability: 1,
    });

    out.length = 0;
    handler.onMessage({
      type: 'seedAtCell',
      lat: baseLat,
      lon: baseLon,
      offsets,
      mode: 'set',
      scale: 1,
      jitter: 0,
      probability: 1,
    });

    const snap = findSnapshot(out)!;
    expect(snap).toBeTruthy();
    expect(new Uint8Array(snap.grid)).toEqual(sim.getGridView());
  });

  it('setRules via worker matches direct setRules and subsequent step', () => {
    const lat = 6;
    const lon = 6;
    const sim = new LifeGridSim({ latCells: lat, lonCells: lon, rules: GOL_RULES });
    const out: unknown[] = [];
    const handler = createLifeGridWorkerHandler((m) => out.push(m));
    handler.onMessage({
      type: 'init',
      latCells: lat,
      lonCells: lon,
      rules: GOL_RULES,
    });

    // seed initial pattern
    const baseLat = 3;
    const baseLon = 3;
    const offsets: [number, number][] = [
      [0, 0],
      [1, 0],
      [-1, 0],
    ];

    sim.seedAtCell({
      lat: baseLat,
      lon: baseLon,
      offsets: offsets,
      mode: 'set',
      scale: 1,
      jitter: 0,
      probability: 1,
    });
    out.length = 0;
    handler.onMessage({
      type: 'seedAtCell',
      lat: baseLat,
      lon: baseLon,
      offsets,
      mode: 'set',
      scale: 1,
      jitter: 0,
      probability: 1,
    });

    // change rules to HighLife (B36/S23) and step
    const highLifeRules = { birth: parseRuleDigits('36'), survive: parseRuleDigits('23') };
    sim.setRules(highLifeRules);
    out.length = 0;
    handler.onMessage({ type: 'setRules', rules: highLifeRules });

    sim.step();
    out.length = 0;
    handler.onMessage({ type: 'tick', steps: 1 });

    const snap = findSnapshot(out)!;
    expect(snap).toBeTruthy();
    expect(new Uint8Array(snap.grid)).toEqual(sim.getGridView());
  });

  it('polarWrap parity between worker and main sim in Classic and Colony modes', () => {
    const lat = 8;
    const lon = 10;
    for (const mode of ['Classic', 'Colony'] as const) {
      const sim = new LifeGridSim({
        latCells: lat,
        lonCells: lon,
        rules: GOL_RULES,
        polarWrap: true,
      });
      sim.setGameMode(mode);

      const out: unknown[] = [];
      const handler = createLifeGridWorkerHandler((m) => out.push(m));
      handler.onMessage({
        type: 'init',
        latCells: lat,
        lonCells: lon,
        rules: GOL_RULES,
        gameMode: mode,
        polarWrap: true,
      });

      const seeds: [number, number][] = [
        [0, 6],
        [0, 8],
        [1, 2],
        [lat - 1, 6],
        [lat - 1, 8],
        [lat - 2, 2],
      ];
      for (const [sLat, sLon] of seeds) {
        sim.setCell(sLat, sLon, mode === 'Colony' ? (sLat === 0 ? 1 : 2) : 1);
        handler.onMessage({
          type: 'seedAtCell',
          lat: sLat,
          lon: sLon,
          offsets: [[0, 0]],
          mode: 'set',
          scale: 1,
          jitter: 0,
          probability: 1,
        });
      }

      if (mode === 'Colony') {
        // Ensure deterministic matching state before stepping
        sim.clear();
        handler.onMessage({ type: 'clear' });
        for (const [sLat, sLon] of seeds) {
          sim.setCell(sLat, sLon, 1);
        }
        // Seed via offsets in worker with toggle so Colony A (1) is deterministic
        for (const [sLat, sLon] of seeds) {
          handler.onMessage({
            type: 'seedAtCell',
            lat: sLat,
            lon: sLon,
            offsets: [[0, 0]],
            mode: 'toggle',
            scale: 1,
            jitter: 0,
            probability: 1,
          });
        }
      }

      sim.step();
      out.length = 0;
      handler.onMessage({ type: 'tick', steps: 1 });

      const snap = findSnapshot(out)!;
      expect(snap).toBeTruthy();
      expect(new Uint8Array(snap.grid)).toEqual(sim.getGridView());
      expect(snap.population).toBe(sim.population);
    }
  });
});
