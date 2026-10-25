import { useCallback, useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';

import { createRenderTarget, type Resolution } from './common';

export interface GpuPingPong {
  targetA: THREE.WebGLRenderTarget;
  targetB: THREE.WebGLRenderTarget;
  /** Which buffer currently holds the latest state ("read" buffer). */
  currentBufferRef: React.MutableRefObject<'A' | 'B'>;
  /** The current read target and the opposite write target. */
  getBuffers: () => { read: THREE.WebGLRenderTarget; write: THREE.WebGLRenderTarget };
  /** Make the other buffer current (call after rendering into it). */
  swap: () => void;
}

/**
 * Double-buffered render targets for the GPU simulation. Targets are rebuilt
 * when the resolution changes, and every target is disposed when it is
 * replaced and on unmount.
 */
export function useGpuPingPong(resolution: Resolution): GpuPingPong {
  const targetA = useMemo(
    () => createRenderTarget(resolution.width, resolution.height),
    [resolution.height, resolution.width],
  );
  const targetB = useMemo(
    () => createRenderTarget(resolution.width, resolution.height),
    [resolution.height, resolution.width],
  );

  const currentBufferRef = useRef<'A' | 'B'>('A');

  const getBuffers = useCallback(
    () =>
      currentBufferRef.current === 'A'
        ? { read: targetA, write: targetB }
        : { read: targetB, write: targetA },
    [targetA, targetB],
  );

  const swap = useCallback(() => {
    currentBufferRef.current = currentBufferRef.current === 'A' ? 'B' : 'A';
  }, []);

  useEffect(() => {
    return () => {
      targetA.dispose();
      targetB.dispose();
    };
  }, [targetA, targetB]);

  return { targetA, targetB, currentBufferRef, getBuffers, swap };
}
