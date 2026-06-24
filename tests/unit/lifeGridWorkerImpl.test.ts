import { describe, expect, it } from 'vitest';

import type { Rules } from '../../src/sim/rules';
import { createLifeGridWorkerHandler } from '../../src/workers/lifeGridWorkerImpl';
import type { LifeGridWorkerOutMessage } from '../../src/workers/lifeGridWorkerMessages';

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
    expect(snap!.aliveIndices.byteLength).toBe(8 * 16 * 4);
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
    const first = (out.filter((m) => m.type === 'snapshot') as any[]).pop();
    expect(first).toBeTruthy();

    // Simulate main-thread returning the buffers.
    handler.onMessage({
      type: 'recycle',
      grid: first!.grid,
      age: first!.age,
      heat: first!.heat,
      aliveIndices: first!.aliveIndices,
    });

    out.length = 0;
    handler.onMessage({ type: 'tick', steps: 1 });
    const second = (out.filter((m) => m.type === 'snapshot') as any[]).pop();
    expect(second).toBeTruthy();

    // Implementation uses a pool pop, so we should see the same buffers reused.
    expect(second!.grid).toBe(first!.grid);
    expect(second!.age).toBe(first!.age);
    expect(second!.heat).toBe(first!.heat);
    expect(second!.aliveIndices).toBe(first!.aliveIndices);
  });

  it('sends an error for commands before init', () => {
    const out: LifeGridWorkerOutMessage[] = [];
    const handler = createLifeGridWorkerHandler((m) => out.push(m));

    // setRules should return an error when not initialized
    handler.onMessage({ type: 'setRules', rules: GOL_RULES });
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
    });
    out.length = 0;

    handler.onMessage({ type: 'randomize', density: 1 });
    let snap = (out.filter((m) => m.type === 'snapshot') as any[]).pop();
    expect(snap).toBeTruthy();

    out.length = 0;
    handler.onMessage({ type: 'tick' });
    snap = (out.filter((m) => m.type === 'snapshot') as any[]).pop();
    expect(snap).toBeTruthy();
    expect(typeof snap!.generation).toBe('number');
  });

  it('drops recycled buffers whose size no longer matches the current sim (regression: pool leak on resize)', () => {
    const out: LifeGridWorkerOutMessage[] = [];
    const handler = createLifeGridWorkerHandler((m) => out.push(m));

    // SIM_CONSTRAINTS enforce a minimum of 8 cells per axis, so 4x4 and
    // 2x2 are not legal sim sizes — we use 8x8 vs 16x16 (or 8x8 vs
    // 8x16) to test the size-mismatch path. The point of the test is
    // that mismatched buffers are NOT pooled.
    handler.onMessage({
      type: 'init',
      latCells: 8,
      lonCells: 8,
      rules: GOL_RULES,
      randomDensity: 0,
    });
    const small = (out.filter((m) => m.type === 'snapshot') as any[]).pop();
    handler.onMessage({
      type: 'recycle',
      grid: small!.grid,
      age: small!.age,
      heat: small!.heat,
      aliveIndices: small!.aliveIndices,
    });

    // Re-init with a larger grid. Old-size buffers are now stale.
    handler.onMessage({
      type: 'init',
      latCells: 16,
      lonCells: 16,
      rules: GOL_RULES,
      randomDensity: 0,
    });
    out.length = 0;
    handler.onMessage({ type: 'tick', steps: 1 });
    const bigger = (out.filter((m) => m.type === 'snapshot') as any[]).pop();
    expect(bigger).toBeTruthy();
    expect(bigger!.grid.byteLength).toBe(16 * 16);
    expect(bigger!.grid).not.toBe(small!.grid);

    // Recycle the new (correct-size) buffers, then init with a different
    // shape (8x16) so the buffer size no longer matches.
    handler.onMessage({
      type: 'recycle',
      grid: bigger!.grid,
      age: bigger!.age,
      heat: bigger!.heat,
      aliveIndices: bigger!.aliveIndices,
    });
    handler.onMessage({
      type: 'init',
      latCells: 8,
      lonCells: 16,
      rules: GOL_RULES,
      randomDensity: 0,
    });
    out.length = 0;
    handler.onMessage({ type: 'tick', steps: 1 });
    const narrow = (out.filter((m) => m.type === 'snapshot') as any[]).pop();
    expect(narrow).toBeTruthy();
    // 8 x 16 = 128 bytes per cell-layer buffer.
    expect(narrow!.grid.byteLength).toBe(8 * 16);
    // The buffers must be freshly allocated — they should not be the
    // 16x16 (256-byte) buffers we just recycled.
    expect(narrow!.grid).not.toBe(bigger!.grid);
    expect(narrow!.grid).not.toBe(small!.grid);
  });

  it('handles seedAtCell after init', () => {
    const out: LifeGridWorkerOutMessage[] = [];
    const handler = createLifeGridWorkerHandler((m) => out.push(m));

    handler.onMessage({
      type: 'init',
      latCells: 3,
      lonCells: 3,
      rules: GOL_RULES,
    });
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
    });
    const snap = (out.filter((m) => m.type === 'snapshot') as any[]).pop();
    expect(snap).toBeTruthy();
  });
});
