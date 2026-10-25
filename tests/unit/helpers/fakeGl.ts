import type * as THREE from 'three';
import { vi } from 'vitest';

type Deferred = { resolve: () => void; reject: (e: unknown) => void };

/** Minimal WebGLRenderer double covering what the GPU sim hooks call. */
export function createFakeGl(opts: { async?: boolean } = {}) {
  const pendingReads: Deferred[] = [];
  let current: THREE.WebGLRenderTarget | null = null;
  const gl = {
    getRenderTarget: vi.fn(() => current),
    setRenderTarget: vi.fn((t: THREE.WebGLRenderTarget | null) => {
      current = t;
    }),
    render: vi.fn(),
    clear: vi.fn(),
    readRenderTargetPixels: vi.fn(),
    readRenderTargetPixelsAsync: opts.async
      ? vi.fn(
          () =>
            new Promise<void>((resolve, reject) => {
              pendingReads.push({ resolve, reject });
            }),
        )
      : undefined,
  };
  return { gl: gl as unknown as THREE.WebGLRenderer, mocks: gl, pendingReads };
}
