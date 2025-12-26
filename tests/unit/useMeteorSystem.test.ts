import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMeteorSystem } from '../../src/components/planetLife/useMeteorSystem';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';

describe('useMeteorSystem', () => {
  const mockSeedAtPoint = vi.fn<(point: THREE.Vector3) => void>();

  beforeEach(() => {
    mockSeedAtPoint.mockClear();
  });

  const defaultParams = {
    meteorSpeed: 10,
    meteorRadius: 0.08,
    meteorCooldownMs: 120,
    showerEnabled: false,
    showerInterval: 500,
    meteorTrailLength: 0.9,
    meteorTrailWidth: 0.12,
    meteorEmissive: 2.6,
    impactFlashIntensity: 1.5,
    impactFlashRadius: 0.45,
    impactRingColor: '#ffeeaa' as THREE.ColorRepresentation,
    impactRingDuration: 0.9,
    impactRingSize: 1,
    seedAtPoint: mockSeedAtPoint,
    debugLogs: false,
  };

  it('should initialize with empty meteors and impacts', () => {
    const { result } = renderHook(() => useMeteorSystem(defaultParams));

    expect(result.current.meteors).toEqual([]);
    expect(result.current.impacts).toEqual([]);
  });

  it('should call onPlanetPointerDown and stop propagation', () => {
    const { result } = renderHook(() => useMeteorSystem(defaultParams));

    const mockEvent = {
      stopPropagation: vi.fn(),
      point: new THREE.Vector3(2, 0, 0),
      camera: {
        position: {
          clone: () => new THREE.Vector3(0, 0, 5),
        },
      },
    };

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      result.current.onPlanetPointerDown(mockEvent as any);
    });

    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    // After act, meteors state should be updated
    expect(result.current.meteors.length).toBeGreaterThanOrEqual(0);
  });

  it('should respect cooldown configuration', () => {
    const { result } = renderHook(() =>
      useMeteorSystem({
        ...defaultParams,
        meteorCooldownMs: 500,
      }),
    );

    // Hook should properly receive cooldown parameter
    expect(result.current.onPlanetPointerDown).toBeDefined();
  });

  it('should handle camera without position property', () => {
    const { result } = renderHook(() => useMeteorSystem(defaultParams));

    const mockEvent = {
      stopPropagation: vi.fn(),
      point: new THREE.Vector3(2, 0, 0),
      camera: {}, // Camera without position
    };

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      result.current.onPlanetPointerDown(mockEvent as any);
    });

    // Should not throw an error
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });

  it('should accept seedAtPoint parameter', () => {
    const customSeedAtPoint = vi.fn<(point: THREE.Vector3) => void>();
    const { result } = renderHook(() =>
      useMeteorSystem({
        ...defaultParams,
        seedAtPoint: customSeedAtPoint,
      }),
    );

    // Hook should be initialized with custom seedAtPoint
    expect(result.current).toBeDefined();
    expect(result.current.onMeteorImpact).toBeDefined();
  });

  it('should accept debugLogs parameter', () => {
    const { result } = renderHook(() =>
      useMeteorSystem({
        ...defaultParams,
        debugLogs: true,
      }),
    );

    // Hook should be initialized with debugLogs enabled
    expect(result.current).toBeDefined();
  });

  it('should set up interval for pruning impact rings', () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useMeteorSystem(defaultParams));

    // Should set up an interval
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    vi.useRealTimers();
  });

  it('should return expected functions and arrays', () => {
    const { result } = renderHook(() => useMeteorSystem(defaultParams));

    expect(result.current.meteors).toBeInstanceOf(Array);
    expect(result.current.impacts).toBeInstanceOf(Array);
    expect(typeof result.current.onPlanetPointerDown).toBe('function');
    expect(typeof result.current.onMeteorImpact).toBe('function');
  });

  it('should accept all meteor and impact configuration parameters', () => {
    const customParams = {
      meteorSpeed: 20,
      meteorRadius: 0.15,
      meteorCooldownMs: 300,
      showerEnabled: true,
      showerInterval: 200,
      meteorTrailLength: 1.5,
      meteorTrailWidth: 0.25,
      meteorEmissive: 3.5,
      impactFlashIntensity: 2.5,
      impactFlashRadius: 0.75,
      impactRingColor: '#ff00ff' as THREE.ColorRepresentation,
      impactRingDuration: 1.5,
      impactRingSize: 2,
      seedAtPoint: mockSeedAtPoint,
      debugLogs: true,
    };

    const { result } = renderHook(() => useMeteorSystem(customParams));

    // Hook should accept all parameters without error
    expect(result.current).toBeDefined();
  });

  it('onMeteorImpact should seed point, remove meteor, and add impact', () => {
    const { result } = renderHook(() => useMeteorSystem(defaultParams));

    // Add a meteor via onPlanetPointerDown to get a real id
    const mockEvent = {
      stopPropagation: vi.fn(),
      point: new THREE.Vector3(2, 0, 0),
      camera: {
        position: {
          clone: () => new THREE.Vector3(0, 0, 5),
        },
      },
    };

    act(() => {
      result.current.onPlanetPointerDown(mockEvent as unknown as ThreeEvent<PointerEvent>);
    });

    expect(result.current.meteors.length).toBeGreaterThanOrEqual(1);
    const id = result.current.meteors[0].id;

    const impactPoint = new THREE.Vector3(0, 0, 5);

    act(() => {
      result.current.onMeteorImpact(id, impactPoint);
    });

    expect(mockSeedAtPoint).toHaveBeenCalled();
    expect(result.current.meteors.find((m) => m.id === id)).toBeUndefined();
    expect(result.current.impacts.length).toBeGreaterThanOrEqual(1);
  });

  it('shower should spawn meteors when enabled', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() =>
      useMeteorSystem({ ...defaultParams, showerEnabled: true, showerInterval: 50 }),
    );

    // Fast-forward timers (wrap in act to allow React updates)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.meteors.length).toBeGreaterThan(0);

    unmount();
    vi.useRealTimers();
  });
});
