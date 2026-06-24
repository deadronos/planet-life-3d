import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetGpuSimulationSupportCacheForTests,
  getGpuSimulationSupport,
  isGpuSimulationSupported,
} from '../../src/sim/gpuSupport';

// jsdom does not expose `WebGL2RenderingContext` on globalThis. The helper
// gates on `typeof WebGL2RenderingContext === 'undefined'`, so we install a
// stub class here that satisfies the type check. The tests then mock
// `document.createElement` to return a fake canvas whose `getContext`
// returns a hand-rolled WebGL2-shaped object so we can exercise every
// branch of the probe.
if (
  typeof (globalThis as { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext === 'undefined'
) {
  (globalThis as { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext = class FakeWebGL2 {};
}

interface FakeGpu {
  getSupportedExtensions: () => string[];
  getExtension: (name: string) => { loseContext: () => void } | null;
}

function makeFakeGpu(extensions: string[], loseContext = vi.fn()): FakeGpu {
  return {
    getSupportedExtensions: () => extensions,
    getExtension: (name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null),
  };
}

function makeFakeCanvas(gl: WebGL2RenderingContext | null): HTMLCanvasElement {
  return {
    getContext: vi.fn().mockReturnValue(gl),
  } as unknown as HTMLCanvasElement;
}

describe('gpuSupport', () => {
  beforeEach(() => {
    __resetGpuSimulationSupportCacheForTests();
  });

  afterEach(() => {
    __resetGpuSimulationSupportCacheForTests();
    vi.restoreAllMocks();
  });

  it('reports unsupported when there is no DOM (Node / SSR environment)', () => {
    // jsdom is active in this test runner, so we explicitly simulate a
    // browser-less environment by stubbing the globals out.
    const g = globalThis as Record<string, unknown>;
    const originalDocument = g.document;
    const originalWindow = g.window;
    delete g.document;
    delete g.window;

    try {
      const result = getGpuSimulationSupport();
      expect(result.supported).toBe(false);
      expect(result.reason).toMatch(/No DOM available/);
      expect(isGpuSimulationSupported()).toBe(false);
    } finally {
      g.document = originalDocument;
      g.window = originalWindow;
    }
  });

  it('reports unsupported when getContext returns null', () => {
    const fakeCanvas = makeFakeCanvas(null);
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(fakeCanvas);

    const result = getGpuSimulationSupport();
    expect(createElementSpy).toHaveBeenCalledWith('canvas');
    expect(result.supported).toBe(false);
    expect(result.reason).toMatch(/WebGL2 context creation failed/);
  });

  it('reports unsupported when EXT_color_buffer_float is missing', () => {
    const loseContext = vi.fn();
    const fakeGl = makeFakeGpu(['WEBGL_debug_renderer_info'], loseContext);
    const fakeCanvas = makeFakeCanvas(fakeGl as unknown as WebGL2RenderingContext);
    vi.spyOn(document, 'createElement').mockReturnValue(fakeCanvas);

    const result = getGpuSimulationSupport();
    expect(result.supported).toBe(false);
    expect(result.reason).toMatch(/EXT_color_buffer_float/);
    // We should still release the probe context even when unsupported.
    expect(loseContext).toHaveBeenCalled();
  });

  it('reports supported when WebGL2 + EXT_color_buffer_float are present', () => {
    const loseContext = vi.fn();
    const fakeGl = makeFakeGpu(
      ['EXT_color_buffer_float', 'WEBGL_debug_renderer_info'],
      loseContext,
    );
    const fakeCanvas = makeFakeCanvas(fakeGl as unknown as WebGL2RenderingContext);
    vi.spyOn(document, 'createElement').mockReturnValue(fakeCanvas);

    const result = getGpuSimulationSupport();
    expect(result.supported).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(isGpuSimulationSupported()).toBe(true);
    // Context should be released even on the success path.
    expect(loseContext).toHaveBeenCalled();
  });

  it('caches the result so document.createElement is only called once', () => {
    const loseContext = vi.fn();
    const fakeGl = makeFakeGpu(['EXT_color_buffer_float'], loseContext);
    const fakeCanvas = makeFakeCanvas(fakeGl as unknown as WebGL2RenderingContext);
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(fakeCanvas);

    expect(getGpuSimulationSupport().supported).toBe(true);
    expect(getGpuSimulationSupport().supported).toBe(true);
    expect(getGpuSimulationSupport().supported).toBe(true);
    expect(createElementSpy).toHaveBeenCalledTimes(1);
  });

  it('reports unsupported and never throws when getContext itself throws', () => {
    const fakeCanvas = {
      getContext: vi.fn().mockImplementation(() => {
        throw new Error('boom');
      }),
    } as unknown as HTMLCanvasElement;
    vi.spyOn(document, 'createElement').mockReturnValue(fakeCanvas);

    const result = getGpuSimulationSupport();
    expect(result.supported).toBe(false);
    expect(result.reason).toMatch(/GPU probe threw/);
  });
});
