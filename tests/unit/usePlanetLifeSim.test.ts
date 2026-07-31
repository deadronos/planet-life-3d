import { act, renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePlanetLifeSim } from '../../src/components/planetLife/usePlanetLifeSim';
import { useUIStore } from '../../src/store/useUIStore';

const RULES = {
  birth: [false, false, false, true, false, false, false, false, false],
  survive: [false, false, true, true, false, false, false, false, false],
};
const STALE_STATS = {
  generation: 123,
  population: 456,
  birthsLastTick: 789,
  deathsLastTick: 999,
};

describe('usePlanetLifeSim stats publishing', () => {
  beforeEach(() => {
    useUIStore.setState({
      stats: {
        generation: 0,
        population: 0,
        birthsLastTick: 0,
        deathsLastTick: 0,
      },
    });
  });

  it('publishes stats after clear, randomize, and stepOnce in CPU mode', () => {
    const lifeTex = {
      w: 4,
      h: 3,
      data: new Uint8Array(4 * 3 * 4),
      tex: new THREE.DataTexture(new Uint8Array(4 * 3 * 4), 4, 3, THREE.RGBAFormat),
    };
    const setMatrixAt = vi.fn<(index: number, matrix: THREE.Matrix4) => void>();
    const setColorAt = vi.fn<(index: number, color: THREE.Color) => void>();
    const mesh = {
      instanceMatrix: {
        setUsage: vi.fn(),
        needsUpdate: false,
      },
      instanceColor: {
        setUsage: vi.fn(),
        needsUpdate: false,
      },
      setMatrixAt,
      setColorAt,
      count: 0,
    } as unknown as THREE.InstancedMesh;

    const { result } = renderHook(() =>
      usePlanetLifeSim({
        running: false,
        tickMs: 100,
        safeLatCells: 3,
        safeLonCells: 4,
        planetRadius: 2,
        cellLift: 0.015,
        cellRenderMode: 'Dots',
        gameMode: 'Classic',
        rules: RULES,
        ecologyProfile: 'None',
        randomDensity: 1,
        workerSim: false,
        lifeTex,
        dummy: new THREE.Object3D(),
        cellsRef: { current: mesh },
        resolveCellColor: () => 1,
        colorScratch: new THREE.Color(),
        debugLogs: false,
      }),
    );

    const assertStatsMatchSim = () => {
      const sim = result.current.simRef.current;
      expect(sim).not.toBeNull();
      expect(useUIStore.getState().stats).toEqual({
        generation: sim?.generation ?? -1,
        population: sim?.population ?? -1,
        birthsLastTick: sim?.birthsLastTick ?? -1,
        deathsLastTick: sim?.deathsLastTick ?? -1,
      });
    };

    useUIStore.getState().setStats(STALE_STATS);
    act(() => result.current.clear());
    assertStatsMatchSim();

    useUIStore.getState().setStats(STALE_STATS);
    act(() => result.current.randomize());
    assertStatsMatchSim();

    useUIStore.getState().setStats(STALE_STATS);
    act(() => result.current.stepOnce());
    assertStatsMatchSim();
  });
});

describe('usePlanetLifeSim (regression: do not re-randomize on Leva changes)', () => {
  function makeMesh() {
    return {
      instanceMatrix: { setUsage: vi.fn(), needsUpdate: false },
      instanceColor: { setUsage: vi.fn(), needsUpdate: false },
      setMatrixAt: vi.fn(),
      setColorAt: vi.fn(),
      count: 0,
    } as unknown as THREE.InstancedMesh;
  }

  function makeLifeTex() {
    return {
      w: 4,
      h: 3,
      data: new Uint8Array(4 * 3 * 4),
      tex: new THREE.DataTexture(new Uint8Array(4 * 3 * 4), 4, 3, THREE.RGBAFormat),
    };
  }

  it('preserves the running sim when rules change (applies via setRules)', () => {
    const HIGHLIFE = {
      birth: [false, false, false, true, false, false, true, false, false],
      survive: [false, false, true, true, false, false, false, false, false],
    };
    const { result, rerender } = renderHook(
      (props) =>
        usePlanetLifeSim({
          running: false,
          tickMs: 100,
          safeLatCells: 3,
          safeLonCells: 4,
          planetRadius: 2,
          cellLift: 0.015,
          cellRenderMode: 'Dots',
          gameMode: props.gameMode,
          rules: props.rules,
          ecologyProfile: 'None',
          randomDensity: 0.5,
          workerSim: false,
          lifeTex: makeLifeTex(),
          dummy: new THREE.Object3D(),
          cellsRef: { current: makeMesh() },
          resolveCellColor: () => 1,
          colorScratch: new THREE.Color(),
          debugLogs: false,
        }),
      {
        initialProps: { rules: RULES, gameMode: 'Classic' as const },
      },
    );

    const originalSim = result.current.simRef.current;
    expect(originalSim).not.toBeNull();

    // Apply a recognizable pattern so we can detect if the sim was reset.
    act(() => {
      originalSim!.setCell(1, 1, 1);
      originalSim!.setCell(1, 2, 1);
    });
    const popBefore = originalSim!.population;
    expect(popBefore).toBeGreaterThan(0);

    // Change the rules (this is what typing in birth/survive digits does).
    rerender({ rules: HIGHLIFE, gameMode: 'Classic' });

    // The sim instance must be the same object — no re-randomize.
    const afterSim = result.current.simRef.current;
    expect(afterSim).toBe(originalSim);
    // The cells we set are still alive.
    expect(afterSim!.getCell(1, 1)).toBe(1);
    expect(afterSim!.getCell(1, 2)).toBe(1);
    expect(afterSim!.population).toBe(popBefore);
    // And the new rules were applied: under the old (Conway) rules the
    // marker wouldn't survive without neighbors, but under HighLife the
    // 3-cell blinker pattern at (1,1)-(1,2) plus a missing neighbor
    // gets a deterministic state change. We just confirm the sim is
    // running with the new rules by checking the rule arrays.
    const seenRules = (originalSim as unknown as { rules: { birth: boolean[] } }).rules;
    expect(seenRules.birth[6]).toBe(true); // HighLife has birth at 6
    expect(seenRules.birth[3]).toBe(true); // ...and at 3
  });

  it('preserves the running sim when ecologyProfile changes', () => {
    const { result, rerender } = renderHook(
      (props) =>
        usePlanetLifeSim({
          running: false,
          tickMs: 100,
          safeLatCells: 3,
          safeLonCells: 4,
          planetRadius: 2,
          cellLift: 0.015,
          cellRenderMode: 'Dots',
          gameMode: 'Classic',
          rules: RULES,
          ecologyProfile: props.ecologyProfile,
          randomDensity: 0.5,
          workerSim: false,
          lifeTex: makeLifeTex(),
          dummy: new THREE.Object3D(),
          cellsRef: { current: makeMesh() },
          resolveCellColor: () => 1,
          colorScratch: new THREE.Color(),
          debugLogs: false,
        }),
      {
        initialProps: {
          ecologyProfile: 'None' as
            'None' | 'Garden World' | 'Harsh Mars' | 'Crystal Plague' | 'Meteor Garden',
        },
      },
    );

    const originalSim = result.current.simRef.current;
    act(() => originalSim!.setCell(2, 2, 1));
    const popBefore = originalSim!.population;

    rerender({
      ecologyProfile: 'Garden World' as
        'None' | 'Garden World' | 'Harsh Mars' | 'Crystal Plague' | 'Meteor Garden',
    });

    expect(result.current.simRef.current).toBe(originalSim);
    expect(originalSim!.getCell(2, 2)).toBe(1);
    expect(originalSim!.population).toBe(popBefore);
  });

  it('preserves the running sim when gameMode toggles', () => {
    const { result, rerender } = renderHook(
      (props) =>
        usePlanetLifeSim({
          running: false,
          tickMs: 100,
          safeLatCells: 3,
          safeLonCells: 4,
          planetRadius: 2,
          cellLift: 0.015,
          cellRenderMode: 'Dots',
          gameMode: props.gameMode,
          rules: RULES,
          ecologyProfile: 'None',
          randomDensity: 0.5,
          workerSim: false,
          lifeTex: makeLifeTex(),
          dummy: new THREE.Object3D(),
          cellsRef: { current: makeMesh() },
          resolveCellColor: () => 1,
          colorScratch: new THREE.Color(),
          debugLogs: false,
        }),
      {
        initialProps: { gameMode: 'Classic' as 'Classic' | 'Colony' },
      },
    );

    const originalSim = result.current.simRef.current;
    act(() => originalSim!.setCell(0, 0, 1));
    const popBefore = originalSim!.population;

    rerender({ gameMode: 'Colony' as 'Classic' | 'Colony' });

    expect(result.current.simRef.current).toBe(originalSim);
    expect(originalSim!.getCell(0, 0)).toBe(1);
    expect(originalSim!.population).toBe(popBefore);
    expect(originalSim!.gameMode).toBe('Colony');
  });

  it('does NOT re-randomize when randomDensity slider moves; explicit randomize() does', () => {
    const { result, rerender } = renderHook(
      (props) =>
        usePlanetLifeSim({
          running: false,
          tickMs: 100,
          safeLatCells: 3,
          safeLonCells: 4,
          planetRadius: 2,
          cellLift: 0.015,
          cellRenderMode: 'Dots',
          gameMode: 'Classic',
          rules: RULES,
          ecologyProfile: 'None',
          randomDensity: props.randomDensity,
          workerSim: false,
          lifeTex: makeLifeTex(),
          dummy: new THREE.Object3D(),
          cellsRef: { current: makeMesh() },
          resolveCellColor: () => 1,
          colorScratch: new THREE.Color(),
          debugLogs: false,
        }),
      {
        initialProps: { randomDensity: 0.1 },
      },
    );

    const originalSim = result.current.simRef.current;
    act(() => {
      // Place a deterministic marker.
      originalSim!.setCell(1, 1, 1);
      originalSim!.setCell(2, 2, 1);
    });
    const popBefore = originalSim!.population;
    const genBefore = originalSim!.generation;
    expect(popBefore).toBeGreaterThan(0);

    // Slider moves from 0.1 -> 0.9.
    rerender({ randomDensity: 0.9 });

    // The sim instance must be unchanged and our marker cells must still
    // be alive (no re-randomize from the slider move).
    expect(result.current.simRef.current).toBe(originalSim);
    expect(originalSim!.getCell(1, 1)).toBe(1);
    expect(originalSim!.getCell(2, 2)).toBe(1);
    expect(originalSim!.population).toBe(popBefore);
    expect(originalSim!.generation).toBe(genBefore);

    // Explicit Randomize does use the latest density value.
    act(() => result.current.randomize());
    expect(originalSim!.generation).toBe(0);
    expect(originalSim!.population).toBeGreaterThan(popBefore);
  });
});

describe('usePlanetLifeSim seed stats & GPU-mode stats suppression', () => {
  function makeMesh() {
    return {
      instanceMatrix: { setUsage: vi.fn(), needsUpdate: false },
      instanceColor: { setUsage: vi.fn(), needsUpdate: false },
      setMatrixAt: vi.fn(),
      setColorAt: vi.fn(),
      count: 0,
    } as unknown as THREE.InstancedMesh;
  }

  function makeLifeTex() {
    return {
      w: 4,
      h: 3,
      data: new Uint8Array(4 * 3 * 4),
      tex: new THREE.DataTexture(new Uint8Array(4 * 3 * 4), 4, 3, THREE.RGBAFormat),
    };
  }

  function hookProps(overrides: Record<string, unknown> = {}) {
    return {
      running: false,
      tickMs: 100,
      safeLatCells: 3,
      safeLonCells: 4,
      planetRadius: 2,
      cellLift: 0.015,
      cellRenderMode: 'Dots' as const,
      gameMode: 'Classic' as const,
      rules: RULES,
      ecologyProfile: 'None' as const,
      randomDensity: 0.5,
      workerSim: false,
      lifeTex: makeLifeTex(),
      dummy: new THREE.Object3D(),
      cellsRef: { current: makeMesh() },
      resolveCellColor: () => 1,
      colorScratch: new THREE.Color(),
      debugLogs: false,
      ...overrides,
    };
  }

  it('publishes stats immediately after a CPU seed', () => {
    const { result } = renderHook(() => usePlanetLifeSim(hookProps()));

    useUIStore.getState().setStats({
      generation: 0,
      population: 0,
      birthsLastTick: 0,
      deathsLastTick: 0,
    });
    act(() =>
      result.current.seedAtPoint({
        point: new THREE.Vector3(1, 0, 0),
        offsets: [
          [0, 0],
          [0, 1],
        ],
        mode: 'set',
        scale: 1,
        jitter: 0,
        probability: 1,
      }),
    );

    expect(useUIStore.getState().stats.population).toBeGreaterThan(0);
  });

  it('does not publish CPU/worker stats when gpuSim is authoritative', () => {
    const { result } = renderHook(() => usePlanetLifeSim(hookProps({ gpuSim: true })));

    useUIStore.getState().setStats(STALE_STATS);
    act(() => result.current.clear());
    expect(useUIStore.getState().stats).toEqual(STALE_STATS);

    useUIStore.getState().setStats(STALE_STATS);
    act(() => result.current.randomize());
    expect(useUIStore.getState().stats).toEqual(STALE_STATS);

    useUIStore.getState().setStats(STALE_STATS);
    act(() => result.current.stepOnce());
    expect(useUIStore.getState().stats).toEqual(STALE_STATS);
  });
});

describe('usePlanetLifeSim geometry-only updates', () => {
  function makeMesh() {
    return {
      instanceMatrix: { setUsage: vi.fn(), needsUpdate: false },
      instanceColor: { setUsage: vi.fn(), needsUpdate: false },
      setMatrixAt: vi.fn(),
      setColorAt: vi.fn(),
      count: 0,
    } as unknown as THREE.InstancedMesh;
  }

  function makeLifeTex() {
    return {
      w: 4,
      h: 3,
      data: new Uint8Array(4 * 3 * 4),
      tex: new THREE.DataTexture(new Uint8Array(4 * 3 * 4), 4, 3, THREE.RGBAFormat),
    };
  }

  it('planetRadius/cellLift changes update positions without re-randomizing', () => {
    const { result, rerender } = renderHook(
      (props) =>
        usePlanetLifeSim({
          running: false,
          tickMs: 100,
          safeLatCells: 3,
          safeLonCells: 4,
          planetRadius: props.planetRadius,
          cellLift: props.cellLift,
          cellRenderMode: 'Dots',
          gameMode: 'Classic',
          rules: RULES,
          ecologyProfile: 'None',
          randomDensity: 0.5,
          workerSim: false,
          lifeTex: makeLifeTex(),
          dummy: new THREE.Object3D(),
          cellsRef: { current: makeMesh() },
          resolveCellColor: () => 1,
          colorScratch: new THREE.Color(),
          debugLogs: false,
        }),
      {
        initialProps: { planetRadius: 2, cellLift: 0.015 },
      },
    );

    const originalSim = result.current.simRef.current;
    act(() => {
      originalSim!.setCell(1, 1, 1);
      originalSim!.setCell(1, 2, 1);
    });
    const popBefore = originalSim!.population;
    expect(popBefore).toBeGreaterThan(0);

    rerender({ planetRadius: 3.5, cellLift: 0.1 });

    const afterSim = result.current.simRef.current;
    expect(afterSim).toBe(originalSim);
    expect(afterSim!.getCell(1, 1)).toBe(1);
    expect(afterSim!.getCell(1, 2)).toBe(1);
    expect(afterSim!.population).toBe(popBefore);
    expect(afterSim!.positions[0].length()).toBeCloseTo(3.6, 4);
  });
});
