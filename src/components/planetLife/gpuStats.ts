/**
 * Helpers for the GPU-simulation HUD stats readback.
 *
 * The stats pass renders one texel per cell (R = birth, G = death, B = alive)
 * into an offscreen target; the main thread then reduces that buffer to three
 * numbers. Both the reduction and the readback cadence live here so they can
 * be unit tested without a WebGL context.
 */

/**
 * How many simulation ticks to skip between HUD stats readbacks.
 *
 * Reading pixels back from the GPU forces a synchronisation point that costs
 * far more than the transfer itself, so we sample periodically instead of on
 * every tick. At the default 120ms tick rate this keeps the HUD at most
 * ~1s stale while removing ~88% of the stalls.
 */
export const STATS_READBACK_INTERVAL = 8;

/** Population/birth/death totals decoded from a stats readback. */
export interface GpuStatsTotals {
  population: number;
  births: number;
  deaths: number;
}

/**
 * Decode a stats readback buffer into totals.
 *
 * Sums the three classification channels across every texel. Each contributing
 * texel contributes a full 255 to its channel, so the result is the affected
 * cell count scaled by 255.
 *
 * @param pixels RGBA bytes from the stats render target.
 */
export function sumStatsPixels(pixels: Uint8Array): GpuStatsTotals {
  let births = 0;
  let deaths = 0;
  let population = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    births += pixels[i];
    deaths += pixels[i + 1];
    population += pixels[i + 2];
  }
  return { population, births, deaths };
}

/**
 * Decide whether a stats readback is due for the given tick.
 *
 * @param tick Monotonic count of readback requests, incremented per call.
 * @param interval Ticks to skip between readbacks. Values below 1 are
 *   treated as "every tick" so a misconfigured interval degrades to the old
 *   behaviour instead of stalling the HUD forever.
 */
export function isStatsReadbackDue(
  tick: number,
  interval: number = STATS_READBACK_INTERVAL,
): boolean {
  const every = Number.isFinite(interval) && interval >= 1 ? Math.floor(interval) : 1;
  return tick % every === 0;
}
