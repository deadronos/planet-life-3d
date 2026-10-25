import { beforeEach, describe, expect, it } from 'vitest';

import { LifeGridSim } from '../../src/sim/LifeGridSim';
import { createSeededRng, parseWorldSeed } from '../../src/sim/seededRng';
import { createControlDefaults, useControlsStore } from '../../src/store/useControlsStore';
import { applyWorld, decodeWorld, encodeWorld } from '../../src/utils/shareUrl';

describe('seeded RNG', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const seqA = Array.from({ length: 5 }, () => a());
    expect(seqA).toEqual(Array.from({ length: 5 }, () => b()));
    expect(seqA).not.toEqual(Array.from({ length: 5 }, createSeededRng(43)));
    seqA.forEach((v) => expect(v >= 0 && v < 1).toBe(true));
  });

  it('randomize with the same seed gives the same grid (also Colony)', () => {
    for (const mode of ['Classic', 'Colony'] as const) {
      const make = (seed: number) => {
        const sim = new LifeGridSim({
          latCells: 20,
          lonCells: 30,
          rules: {
            birth: [false, false, false, true, false, false, false, false, false],
            survive: [false, false, true, true, false, false, false, false, false],
          },
        });
        sim.setGameMode(mode);
        sim.randomize(0.3, createSeededRng(seed));
        return Array.from(sim.getGridView());
      };
      expect(make(7)).toEqual(make(7));
      expect(make(7)).not.toEqual(make(8));
    }
  });

  it('parses seeds strictly', () => {
    expect(parseWorldSeed('4294967295')).toBe(4294967295);
    expect(parseWorldSeed('4294967296')).toBeUndefined();
    expect(parseWorldSeed('-1')).toBeUndefined();
    expect(parseWorldSeed('abc')).toBeUndefined();
  });
});

describe('share URL', () => {
  beforeEach(() => useControlsStore.getState().resetControls());

  it('round-trips', () => {
    const state = {
      ...createControlDefaults(),
      worldPreset: 'Garden World',
      birthDigits: '36',
      surviveDigits: '23',
      latCells: 96,
      lonCells: 160,
      randomDensity: 0.14,
      gameMode: 'Colony' as const,
    };
    const hash = encodeWorld(state, 12345);
    const w = decodeWorld(`#${hash}`);
    expect(w.seed).toBe(12345);
    expect(w.preset).toEqual({ worldPreset: 'Garden World' });
    expect(w.controls).toMatchObject({
      birthDigits: '36',
      surviveDigits: '23',
      latCells: 96,
      lonCells: 160,
      randomDensity: 0.14,
      gameMode: 'Colony',
      rulePreset: 'Custom',
    });
  });

  it('drops invalid params and clamps ints', () => {
    const w = decodeWorld(
      '#w=Nope&b=9x&s=2&t=Nope&e=Nope&sp=Nope&g=1x9999&d=7&seed=-3&evil=1&m=Hex',
    );
    expect(w.preset).toBeUndefined();
    expect(w.seed).toBeUndefined();
    expect(w.controls).toEqual({
      surviveDigits: '2',
      rulePreset: 'Custom',
      latCells: 8,
      lonCells: 512,
      randomDensity: 1,
    });
    expect(decodeWorld('garbage%%%')).toEqual({ controls: {}, seed: undefined });
  });

  it('applies the preset first so explicit params win over its defaults', () => {
    // Garden World's preset sets birth '3'; the URL overrides it.
    applyWorld(
      decodeWorld('#w=Garden+World&b=36&g=40x50'),
      useControlsStore.getState().setControls,
    );
    const s = useControlsStore.getState();
    expect(s.worldPreset).toBe('Garden World');
    expect(s.birthDigits).toBe('36');
    expect(s.latCells).toBe(40);
  });
});
