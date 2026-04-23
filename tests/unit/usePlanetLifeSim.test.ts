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
