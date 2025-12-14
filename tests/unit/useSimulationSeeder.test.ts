import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSimulationSeeder } from '../../src/components/planetLife/useSimulationSeeder';
import { LifeSphereSim } from '../../src/sim/LifeSphereSim';
import * as THREE from 'three';
import type { RefObject } from 'react';

describe('useSimulationSeeder', () => {
  let mockSim: LifeSphereSim;
  let mockSimRef: RefObject<LifeSphereSim | null>;
  let mockUpdateInstances: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    mockSim = new LifeSphereSim({
      latCells: 30,
      lonCells: 60,
      planetRadius: 2,
      cellLift: 0.02,
      rules: {
        birth: [false, false, false, true, false, false, false, false, false],
        survive: [false, false, true, true, false, false, false, false, false],
      },
    });
    mockSim.seedAtPoint = vi.fn<LifeSphereSim['seedAtPoint']>();

    mockSimRef = { current: mockSim };
    mockUpdateInstances = vi.fn<() => void>();
  });

  it('should use builtin pattern offsets for known patterns', () => {
    const { result } = renderHook(() =>
      useSimulationSeeder({
        simRef: mockSimRef,
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

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockSim.seedAtPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        point,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
        simRef: mockSimRef,
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

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockSim.seedAtPoint).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const call = (mockSim.seedAtPoint as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(call.offsets.length).toBeGreaterThan(0);
  });

  it('should generate random disk offsets when pattern is Random Disk', () => {
    const { result } = renderHook(() =>
      useSimulationSeeder({
        simRef: mockSimRef,
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

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockSim.seedAtPoint).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const call = (mockSim.seedAtPoint as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // Random disk should create a circular pattern
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(call.offsets.length).toBeGreaterThan(10); // Multiple cells in disk
  });

  it('should scale random disk size based on seedScale', () => {
    const { result: result1 } = renderHook(() =>
      useSimulationSeeder({
        simRef: mockSimRef,
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
        simRef: mockSimRef,
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const offsets1 = (mockSim.seedAtPoint as ReturnType<typeof vi.fn>).mock.calls[0][0].offsets;

    vi.clearAllMocks();

    result2.current.seedAtPoint(point);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const offsets2 = (mockSim.seedAtPoint as ReturnType<typeof vi.fn>).mock.calls[0][0].offsets;

    // Larger scale should produce more offsets
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    expect(offsets2.length).toBeGreaterThan(offsets1.length);
  });

  it('should pass all parameters to seedAtPoint', () => {
    const { result } = renderHook(() =>
      useSimulationSeeder({
        simRef: mockSimRef,
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

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockSim.seedAtPoint).toHaveBeenCalledWith(
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
        simRef: mockSimRef,
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

  it('should not seed if sim is null', () => {
    const nullSimRef: RefObject<LifeSphereSim | null> = { current: null };
    const { result } = renderHook(() =>
      useSimulationSeeder({
        simRef: nullSimRef,
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

    // Should not throw
    expect(() => result.current.seedAtPoint(point)).not.toThrow();
    expect(mockUpdateInstances).not.toHaveBeenCalled();
  });
});
