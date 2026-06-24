/**
 * GPU simulation support detection.
 *
 * The GPU simulation path (`GPUSimulation.tsx`) relies on:
 *  1. WebGL2 being available in the browser.
 *  2. The `EXT_color_buffer_float` extension, which lets us render to
 *     `THREE.FloatType` render targets. Most desktop browsers support it,
 *     but it is still missing on a handful of mobile / Safari configurations.
 *
 * This module exposes a single cached, side-effect-free predicate that
 * components and the Leva controls can read at startup to decide whether
 * the GPU sim can be enabled by default.
 *
 * The probe creates a tiny offscreen canvas, asks for a WebGL2 context,
 * and inspects the available extensions. It is designed to be safe to call
 * from any environment (Node / SSR / jsdom) and to never throw.
 */

export interface GpuSimulationSupport {
  /** True only when WebGL2 + float-color-buffer support is confirmed. */
  supported: boolean;
  /** Short reason explaining why the GPU sim is not usable, if applicable. */
  reason?: string;
}

let cached: GpuSimulationSupport | undefined;

/**
 * Probe the current environment for GPU simulation support. The result
 * is memoized, so subsequent calls are free.
 */
export function getGpuSimulationSupport(): GpuSimulationSupport {
  if (cached) return cached;

  // No DOM at all (Node SSR / unit tests). Default to unsupported so we
  // fall back to the CPU/Worker sim path.
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    cached = { supported: false, reason: 'No DOM available (SSR or test environment).' };
    return cached;
  }

  // WebGL2 not in the global namespace (very old browsers, jsdom without
  // the canvas mock, etc.).
  if (typeof WebGL2RenderingContext === 'undefined') {
    cached = { supported: false, reason: 'WebGL2 is not available in this environment.' };
    return cached;
  }

  let canvas: HTMLCanvasElement | null = null;
  let gl: WebGL2RenderingContext | null = null;
  try {
    canvas = document.createElement('canvas');
    // 1x1 is enough — we never draw, we only need the GL context + extensions.
    gl = canvas.getContext('webgl2', {
      failIfMajorPerformanceCaveat: false,
    });

    if (!gl) {
      cached = { supported: false, reason: 'WebGL2 context creation failed.' };
      return cached;
    }

    const extensions = gl.getSupportedExtensions() ?? [];
    if (!extensions.includes('EXT_color_buffer_float')) {
      cached = {
        supported: false,
        reason: 'EXT_color_buffer_float extension is unavailable.',
      };
      return cached;
    }

    cached = { supported: true };
    return cached;
  } catch (err) {
    cached = {
      supported: false,
      reason: `GPU probe threw: ${err instanceof Error ? err.message : String(err)}`,
    };
    return cached;
  } finally {
    // Release the probe context immediately — we no longer need it. Some
    // browsers cap the number of live WebGL contexts per page.
    if (gl) {
      const lose = gl.getExtension('WEBGL_lose_context');
      lose?.loseContext();
    }
    // Drop our reference to the canvas so the GC can reclaim it.
    canvas = null;
  }
}

/**
 * Convenience boolean for callers that just want to know "can we use it?".
 */
export function isGpuSimulationSupported(): boolean {
  return getGpuSimulationSupport().supported;
}

/**
 * Test-only hook to clear the memoized result. Production code should
 * never need this — the answer is stable for the lifetime of the page.
 *
 * @internal
 */
export function __resetGpuSimulationSupportCacheForTests(): void {
  cached = undefined;
}
