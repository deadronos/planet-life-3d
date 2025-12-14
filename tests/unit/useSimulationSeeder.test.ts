import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSimulationSeeder } from '../../src/components/planetLife/useSimulationSeeder';
import * as THREE from 'three';
import type { Offset } from '../../src/sim/patterns';
import type { SeedMode } from '../../src/sim/LifeGridSim';

describe('useSimulationSeeder', () => {
  let mockSeedAtPointImpl: ReturnType<
    typeof vi.fn<
      (params: {
        point: THREE.Vector3;
        offsets: Offset[];
        mode: SeedMode;
        scale: number;
        jitter: number;
        probability: number;
        debug?: boolean;
      }) => void
    >
  >;
  let mockUpdateInstances: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    mockSeedAtPointImpl =
      vi.fn<
        (params: {
          point: THREE.Vector3;
          offsets: Offset[];
          mode: SeedMode;
          scale: number;
          jitter: number;
          probability: number;
          debug?: boolean;
        }) => void
      >();
    mockUpdateInstances = vi.fn<() => void>();
  });

  it('should use builtin pattern offsets for known patterns', () => {
    const { result } = renderHook(() =>
      useSimulationSeeder({
        seedAtPointImpl: mockSeedAtPointImpl,
        updateInstances: mockUpdateInstances,
        seedPattern: 'Glider',
        seedScale: 1,
        seedMode: 'set',
        seedJitter: 0,
        seedProbability: 1,
        customPattern: '',
        debugLogs: false,
      }),
    );

    const point = new THREE.Vector3(2, 0, 0);
    result.current.seedAtPoint(point);

    expect(mockSeedAtPointImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        point,
        offsets: expect.any(Array),
        mode: 'set',
        scale: 1,
        jitter: 0,
        probability: 1,
        debug: false,
      }),
    );
    expect(mockUpdateInstances).toHaveBeenCalled();
  });

  it('should use custom ASCII pattern when specified', () => {
    const customPattern = '.O.\nOOO\n.O.';
    const { result } = renderHook(() =>
      useSimulationSeeder({
        seedAtPointImpl: mockSeedAtPointImpl,
        updateInstances: mockUpdateInstances,
        seedPattern: 'Custom ASCII',
        seedScale: 1,
        seedMode: 'set',
        seedJitter: 0,
        seedProbability: 1,
        customPattern,
        debugLogs: false,
      }),
    );

    const point = new THREE.Vector3(2, 0, 0);
    result.current.seedAtPoint(point);

    expect(mockSeedAtPointImpl).toHaveBeenCalled();
    const call = mockSeedAtPointImpl.mock.calls[0][0];
    expect(call.offsets.length).toBeGreaterThan(0);
  });

  it('should generate random disk offsets when pattern is Random Disk', () => {
    const { result } = renderHook(() =>
      useSimulationSeeder({
        seedAtPointImpl: mockSeedAtPointImpl,
        updateInstances: mockUpdateInstances,
        seedPattern: 'Random Disk',
        seedScale: 2,
        seedMode: 'set',
        seedJitter: 0,
        seedProbability: 1,
        customPattern: '',
        debugLogs: false,
      }),
    );

    const point = new THREE.Vector3(2, 0, 0);
    result.current.seedAtPoint(point);

    expect(mockSeedAtPointImpl).toHaveBeenCalled();
    const call = mockSeedAtPointImpl.mock.calls[0][0];
    // Random disk should create a circular pattern
    expect(call.offsets.length).toBeGreaterThan(10); // Multiple cells in disk
  });

  it('should scale random disk size based on seedScale', () => {
    const { result: result1 } = renderHook(() =>
      useSimulationSeeder({
        seedAtPointImpl: mockSeedAtPointImpl,
        updateInstances: mockUpdateInstances,
        seedPattern: 'Random Disk',
        seedScale: 1,
        seedMode: 'set',
        seedJitter: 0,
        seedProbability: 1,
        customPattern: '',
        debugLogs: false,
      }),
    );

    const { result: result2 } = renderHook(() =>
      useSimulationSeeder({
        seedAtPointImpl: mockSeedAtPointImpl,
        updateInstances: mockUpdateInstances,
        seedPattern: 'Random Disk',
        seedScale: 3,
        seedMode: 'set',
        seedJitter: 0,
        seedProbability: 1,
        customPattern: '',
        debugLogs: false,
      }),
    );

    const point = new THREE.Vector3(2, 0, 0);

    result1.current.seedAtPoint(point);
    const offsets1 = mockSeedAtPointImpl.mock.calls[0][0].offsets;

    vi.clearAllMocks();

    result2.current.seedAtPoint(point);
    const offsets2 = mockSeedAtPointImpl.mock.calls[0][0].offsets;

    // Larger scale should produce more offsets
    expect(offsets2.length).toBeGreaterThan(offsets1.length);
  });

  it('should pass all parameters to seedAtPoint', () => {
    const { result } = renderHook(() =>
      useSimulationSeeder({
        seedAtPointImpl: mockSeedAtPointImpl,
        updateInstances: mockUpdateInstances,
        seedPattern: 'Glider',
        seedScale: 2,
        seedMode: 'toggle',
        seedJitter: 3,
        seedProbability: 0.7,
        customPattern: '',
        debugLogs: false,
      }),
    );

    const point = new THREE.Vector3(1, 0, 0);
    result.current.seedAtPoint(point);

    expect(mockSeedAtPointImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        point,
        mode: 'toggle',
        scale: 2,
        jitter: 3,
        probability: 0.7,
        debug: false,
      }),
    );
  });

  it('should log debug information when debugLogs is enabled', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { result } = renderHook(() =>
      useSimulationSeeder({
        seedAtPointImpl: mockSeedAtPointImpl,
        updateInstances: mockUpdateInstances,
        seedPattern: 'Glider',
        seedScale: 1,
        seedMode: 'set',
        seedJitter: 0,
        seedProbability: 1,
        customPattern: '',
        debugLogs: true,
      }),
    );

    const point = new THREE.Vector3(2, 0, 0);
    result.current.seedAtPoint(point);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[PlanetLife] seedAtPoint'));

    consoleSpy.mockRestore();
  });
});
