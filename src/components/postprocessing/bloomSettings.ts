export interface BloomSettings {
  enabled: boolean;
  intensity: number;
  threshold: number;
  radius: number;
}

/**
 * Threshold-based selective bloom: the composer renders into a half-float
 * buffer with renderer tone mapping disabled, so only fragments the scene
 * deliberately pushes above 1.0 (sun, flare, meteors, impact flashes,
 * atmosphere rim) cross the threshold. The lit planet surface stays below it.
 */
export const DEFAULT_BLOOM_SETTINGS: Omit<BloomSettings, 'enabled'> = {
  intensity: 0.5,
  threshold: 1.0,
  radius: 0.6,
};

/**
 * Below this fraction of the device's own pixel ratio the adaptive scaler is
 * signalling GPU pressure, so bloom (a full-screen pass plus a mip chain) is
 * switched off rather than competing with it for the same budget.
 */
export const BLOOM_MIN_DPR_FRACTION = 0.75;

/**
 * Pixel-ratio ceiling while bloom is on. Measured on an Apple M4 at a
 * 1440x900 window: bloom holds 60fps at 1.75 (2520x1575) but not at 2.0
 * (2880x1800), where the adaptive scaler then flaps between the two. Capping
 * the ratio keeps the glow and the frame rate; the extra sharpness of 2.0 is
 * hard to see under a soft glow anyway.
 */
export const BLOOM_MAX_DPR = 1.75;

/** Highest pixel ratio the renderer may use given whether bloom is on. */
export function maxDprFor(bloomEnabled: boolean, deviceDpr: number, defaultMax = 2): number {
  const ceiling = bloomEnabled ? Math.min(defaultMax, BLOOM_MAX_DPR) : defaultMax;
  return Math.max(1, Math.min(ceiling, deviceDpr || 1));
}

/** Phones and tablets default to bloom off; it can still be enabled in Leva. */
export function defaultBloomEnabled(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return !window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Whether bloom should actually run this frame given the user toggle and the
 * pixel ratio the adaptive scaler has settled on.
 */
export function shouldRenderBloom(enabled: boolean, dpr: number, maxDpr: number): boolean {
  if (!enabled) return false;
  if (!(maxDpr > 0)) return true;
  return dpr >= maxDpr * BLOOM_MIN_DPR_FRACTION;
}
