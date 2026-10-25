// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useGpuPingPong } from '../../src/components/gpuSimulation/useGpuPingPong';

afterEach(() => vi.restoreAllMocks());

describe('useGpuPingPong', () => {
  it('alternates read/write buffers on swap', () => {
    const { result } = renderHook(() => useGpuPingPong({ width: 8, height: 4 }));
    const { targetA, targetB, getBuffers, swap } = result.current;
    expect(getBuffers()).toEqual({ read: targetA, write: targetB });
    swap();
    expect(getBuffers()).toEqual({ read: targetB, write: targetA });
    swap();
    expect(getBuffers().read).toBe(targetA);
  });

  it('keeps targets stable across rerenders with the same resolution', () => {
    const { result, rerender } = renderHook(() => useGpuPingPong({ width: 8, height: 4 }));
    const a = result.current.targetA;
    rerender();
    expect(result.current.targetA).toBe(a);
  });

  it('disposes both targets on unmount', () => {
    const spy = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose');
    const { result, unmount } = renderHook(() => useGpuPingPong({ width: 8, height: 4 }));
    const { targetA, targetB } = result.current;
    unmount();
    expect(spy.mock.contexts).toEqual(expect.arrayContaining([targetA, targetB]));
  });

  it('disposes old targets and builds new ones on resolution change', () => {
    const spy = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose');
    const { result, rerender } = renderHook(({ w }) => useGpuPingPong({ width: w, height: 4 }), {
      initialProps: { w: 8 },
    });
    const old = result.current;
    rerender({ w: 16 });
    expect(result.current.targetA).not.toBe(old.targetA);
    expect(result.current.targetA.width).toBe(16);
    expect(spy.mock.contexts).toEqual(expect.arrayContaining([old.targetA, old.targetB]));
  });
});
