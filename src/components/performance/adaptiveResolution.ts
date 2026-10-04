/**
 * Frame-rate driven resolution scaling.
 *
 * The renderer used to run at a fixed `dpr={[1, 2]}`, which means a Retina
 * display always renders ~4x the pixels of a 1080p target whether or not the
 * machine can sustain it. This module decides when to trade resolution for
 * frame rate, and is deliberately free of any three.js or React dependency so
 * the decision can be unit tested directly.
 */

export interface AdaptiveResolutionConfig {
  /** Never scale below this pixel ratio. */
  minDpr: number;
  /** Never scale above this pixel ratio. */
  maxDpr: number;
  /** Frame rate the scaler aims to hold. */
  targetFps: number;
  /** Average FPS below `targetFps * downRatio` triggers a downscale. */
  downRatio: number;
  /**
   * Average FPS at or above `targetFps * upRatio` triggers an upscale.
   *
   * Must be greater than `downRatio`; the gap between the two is the
   * hysteresis band that stops the scaler oscillating around the threshold.
   */
  upRatio: number;
  /** Largest number of frame deltas averaged together. */
  sampleSize: number;
  /**
   * Smallest number of samples that still yields a decision.
   *
   * Waiting for a full window would be actively harmful: a machine running at
   * 3fps needs 15 seconds to collect 45 frames, so the scaler would be slowest
   * to react in precisely the situation it exists to fix. Deciding from a
   * partial window keeps the response time bounded, at the cost of a slightly
   * noisier average.
   */
  minSampleSize: number;
  /**
   * Minimum wall-clock time between adjustments.
   *
   * Measured in milliseconds rather than frames for the same reason: a
   * frame-based cooldown is 60 frames of patience at 60fps but 22 seconds at
   * 3fps.
   */
  cooldownMs: number;
  /** Granularity of a single adjustment. */
  step: number;
}

/**
 * Defaults tuned around a 60Hz target.
 *
 * The scaler downscales below 48fps and only considers upscaling at 57fps or
 * better. That 9fps dead band is the hysteresis: without it, a display
 * hovering near the threshold would flip resolution every few frames, which is
 * far more distracting than a slightly soft image.
 */
export const DEFAULT_ADAPTIVE_RESOLUTION_CONFIG: AdaptiveResolutionConfig = {
  minDpr: 1,
  maxDpr: 2,
  targetFps: 60,
  downRatio: 0.8,
  upRatio: 0.95,
  sampleSize: 45,
  minSampleSize: 10,
  cooldownMs: 1000,
  step: 0.25,
};

/** Round to a stable 2-decimal pixel ratio so repeated steps cannot drift. */
export function roundDpr(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Clamp a pixel ratio into the configured range. */
export function clampDpr(value: number, config: AdaptiveResolutionConfig): number {
  const min = Math.min(config.minDpr, config.maxDpr);
  const max = Math.max(config.minDpr, config.maxDpr);
  return roundDpr(Math.min(max, Math.max(min, value)));
}

/**
 * Decide the next pixel ratio, or return `currentDpr` unchanged.
 *
 * @param currentDpr Ratio currently in use.
 * @param averageFps Averaged frame rate, or `null` when there are not yet
 *   enough samples to decide.
 * @param msSinceChange Wall-clock milliseconds since the last adjustment.
 */
export function decideNextDpr(
  currentDpr: number,
  averageFps: number | null,
  msSinceChange: number,
  config: AdaptiveResolutionConfig = DEFAULT_ADAPTIVE_RESOLUTION_CONFIG,
): number {
  // Not enough data yet.
  if (averageFps === null || !Number.isFinite(averageFps) || averageFps <= 0) return currentDpr;
  if (!Number.isFinite(msSinceChange)) return currentDpr;

  // Rate-limit changes. Reacting every frame would make resolution jitter.
  if (msSinceChange < config.cooldownMs) return currentDpr;

  const downThreshold = config.targetFps * config.downRatio;
  const upThreshold = config.targetFps * config.upRatio;

  if (averageFps < downThreshold) {
    // Already at the floor: nothing to gain, and returning `currentDpr` keeps
    // this from counting as a change.
    if (currentDpr <= config.minDpr) return currentDpr;
    // Clamp rather than bail: when less than one full step remains before the
    // floor we still want the reduction, just a partial one.
    return clampDpr(currentDpr - config.step, config);
  }

  if (averageFps >= upThreshold) {
    if (currentDpr >= config.maxDpr) return currentDpr;
    return clampDpr(currentDpr + config.step, config);
  }

  // Inside the hysteresis band: hold steady.
  return currentDpr;
}

/**
 * Fixed-size rolling window of frame deltas.
 *
 * Uses total elapsed time rather than averaging per-frame rates, so a single
 * long frame cannot be masked by nine fast ones. A mean of 1/dt would report
 * ~108fps for nine 8ms frames plus a 1s stall; the honest figure is ~10fps.
 */
export class FrameRateWindow {
  private readonly deltas: Float64Array;
  private readonly minSamples: number;
  private index = 0;
  private filled = 0;

  constructor(size: number, minSamples = size) {
    this.deltas = new Float64Array(Math.max(1, size));
    this.minSamples = Math.max(1, Math.min(minSamples, this.deltas.length));
  }

  push(deltaSeconds: number): void {
    // Ignore non-finite or non-positive deltas (first frame, tab wake-up,
    // clock adjustments) rather than poisoning the average.
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    this.deltas[this.index] = deltaSeconds;
    this.index = (this.index + 1) % this.deltas.length;
    if (this.filled < this.deltas.length) this.filled += 1;
  }

  /** Number of samples currently held. */
  get sampleCount(): number {
    return this.filled;
  }

  /** True once enough samples have accumulated to decide. */
  get isReady(): boolean {
    return this.filled >= this.minSamples;
  }

  /** True once the window holds a full set of samples. */
  get isFull(): boolean {
    return this.filled >= this.deltas.length;
  }

  /**
   * Average frames per second, or `null` until at least `minSamples` frames
   * have been collected.
   */
  get averageFps(): number | null {
    if (!this.isReady) return null;
    let total = 0;
    for (let i = 0; i < this.filled; i++) total += this.deltas[i];
    if (total <= 0) return null;
    return this.filled / total;
  }

  reset(): void {
    this.index = 0;
    this.filled = 0;
    this.deltas.fill(0);
  }
}
