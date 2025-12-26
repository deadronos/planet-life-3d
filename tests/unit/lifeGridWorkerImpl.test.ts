import { describe, expect, it } from 'vitest';
import type { Rules } from '../../src/sim/rules';
import { createLifeGridWorkerHandler } from '../../src/workers/lifeGridWorkerImpl';
import type {
  LifeGridWorkerOutMessage,
  LifeGridWorkerInMessage,
} from '../../src/workers/lifeGridWorkerMessages';

// Standard Game of Life Rules: B3/S23
const GOL_RULES: Rules = {
  birth: [false, false, false, true, false, false, false, false, false],
  survive: [false, false, true, true, false, false, false, false, false],
};

describe('lifeGridWorkerImpl', () => {
  it('initializes and emits snapshot with buffers', () => {
    const out: LifeGridWorkerOutMessage[] = [];
    const handler = createLifeGridWorkerHandler((m) => out.push(m));

    handler.onMessage({
      type: 'init',
      latCells: 8,
      lonCells: 16,
      rules: GOL_RULES,
      randomDensity: 0,
    });

    expect(out.some((m) => m.type === 'ready')).toBe(true);
    const snap = out.find(
      (m): m is Extract<LifeGridWorkerOutMessage, { type: 'snapshot' }> => m.type === 'snapshot',
    );
    expect(snap).toBeTruthy();
    expect(snap!.grid.byteLength).toBe(8 * 16);
    expect(snap!.age.byteLength).toBe(8 * 16);
    expect(snap!.heat.byteLength).toBe(8 * 16);
  });

  it('recycles snapshot buffers for reuse', () => {
    const out: LifeGridWorkerOutMessage[] = [];
    const handler = createLifeGridWorkerHandler((m) => out.push(m));

    handler.onMessage({
      type: 'init',
      latCells: 6,
      lonCells: 10,
      rules: GOL_RULES,
      randomDensity: 0,
    });
    const first = out.find(
      (m): m is Extract<LifeGridWorkerOutMessage, { type: 'snapshot' }> => m.type === 'snapshot',
    );
    expect(first).toBeTruthy();

    // Simulate main-thread returning the buffers.
    handler.onMessage({ type: 'recycle', grid: first!.grid, age: first!.age, heat: first!.heat });

    out.length = 0;
    handler.onMessage({ type: 'tick', steps: 1 });
    const second = out.find(
      (m): m is Extract<LifeGridWorkerOutMessage, { type: 'snapshot' }> => m.type === 'snapshot',
    );
    expect(second).toBeTruthy();

    // Implementation uses a pool pop, so we should see the same buffers reused.
    expect(second!.grid).toBe(first!.grid);
    expect(second!.age).toBe(first!.age);
    expect(second!.heat).toBe(first!.heat);
  });

  it('sends an error for commands before init', () => {
    const out: LifeGridWorkerOutMessage[] = [];
    const handler = createLifeGridWorkerHandler((m) => out.push(m));

    // setRules should return an error when not initialized
    handler.onMessage({ type: 'setRules', rules: GOL_RULES } as LifeGridWorkerInMessage);
    const err = out.find((m) => m.type === 'error');
    expect(err).toBeTruthy();
  });

  it('supports tick and randomize commands after init', () => {
    const out: LifeGridWorkerOutMessage[] = [];
    const handler = createLifeGridWorkerHandler((m) => out.push(m));

    handler.onMessage({
      type: 'init',
      latCells: 3,
      lonCells: 3,
      rules: GOL_RULES,
    } as LifeGridWorkerInMessage);
    out.length = 0;

    handler.onMessage({ type: 'randomize', density: 1 } as LifeGridWorkerInMessage);
    let snap = out.find(
      (m): m is Extract<LifeGridWorkerOutMessage, { type: 'snapshot' }> => m.type === 'snapshot',
    );
    expect(snap).toBeTruthy();

    out.length = 0;
    handler.onMessage({ type: 'tick' } as LifeGridWorkerInMessage);
    snap = out.find(
      (m): m is Extract<LifeGridWorkerOutMessage, { type: 'snapshot' }> => m.type === 'snapshot',
    );
    expect(snap).toBeTruthy();
    expect(typeof snap!.generation).toBe('number');
  });

  it('handles seedAtCell after init', () => {
    const out: LifeGridWorkerOutMessage[] = [];
    const handler = createLifeGridWorkerHandler((m) => out.push(m));

    handler.onMessage({
      type: 'init',
      latCells: 3,
      lonCells: 3,
      rules: GOL_RULES,
    } as LifeGridWorkerInMessage);
    out.length = 0;

    handler.onMessage({
      type: 'seedAtCell',
      lat: 1,
      lon: 1,
      offsets: [],
      mode: 'set',
      scale: 1,
      jitter: 0,
      probability: 1,
    } as LifeGridWorkerInMessage);
    const snap = out.find(
      (m): m is Extract<LifeGridWorkerOutMessage, { type: 'snapshot' }> => m.type === 'snapshot',
    );
    expect(snap).toBeTruthy();
  });
});
