import { describe, expect, it } from 'vitest';

import {
  isStatsReadbackDue,
  STATS_READBACK_INTERVAL,
  sumStatsPixels,
} from '../../src/components/planetLife/gpuStats';

/** Build an RGBA stats buffer with `cells` buckets of the given kind. */
function makeBuffer(cells: { birth: number; death: number; alive: number }): Uint8Array {
  const total = cells.birth + cells.death + cells.alive;
  const buf = new Uint8Array(total * 4);
  let i = 0;
  for (let n = 0; n < cells.birth; n++) {
    buf[i] = 255;
    i += 4;
  }
  for (let n = 0; n < cells.death; n++) {
    buf[i + 1] = 255;
    i += 4;
  }
  for (let n = 0; n < cells.alive; n++) {
    buf[i + 2] = 255;
    i += 4;
  }
  return buf;
}

describe('sumStatsPixels', () => {
  it('returns all zeros for an empty buffer', () => {
    expect(sumStatsPixels(new Uint8Array(0), 0)).toEqual({
      population: 0,
      births: 0,
      deaths: 0,
    });
  });

  it('counts a fully-alive population', () => {
    const buf = makeBuffer({ birth: 0, death: 0, alive: 42 });
    expect(sumStatsPixels(buf, buf.length / 4).population).toBe(42);
  });

  it('counts births, deaths and population independently', () => {
    const buf = makeBuffer({ birth: 3, death: 5, alive: 100 });
    expect(sumStatsPixels(buf, buf.length / 4)).toEqual({
      population: 100,
      births: 3,
      deaths: 5,
    });
  });

  it('reports zero for a dead board', () => {
    const buf = makeBuffer({ birth: 0, death: 0, alive: 0 });
    expect(sumStatsPixels(buf, 0)).toEqual({ population: 0, births: 0, deaths: 0 });
  });

  it('handles a birth and death on the same texel independently', () => {
    // A texel can only carry one bucket per channel, but a board may contain
    // both kinds across different texels - verify channels are not conflated.
    const buf = new Uint8Array(2 * 4);
    buf[0] = 255; // birth
    buf[5] = 255; // death
    expect(sumStatsPixels(buf, 2)).toEqual({ population: 0, births: 1, deaths: 1 });
  });

  it('scales down partial channel values (anti-aliased/filtered input)', () => {
    // A readback filtered to 50% should count as half a cell rather than
    // being rounded up to a whole one.
    const buf = new Uint8Array(4);
    buf[2] = 128;
    expect(sumStatsPixels(buf, buf.length / 4).population).toBeCloseTo(128 / 255, 6);
  });

  it('ignores texels beyond the region the readback refreshed', () => {
    // The shared readback buffer is reused and only grows, so after a
    // resolution drop it can be much larger than the live target. Bytes past
    // `texelCount` are stale (or uninitialised on the async path) and must
    // not contribute to the totals.
    const buf = makeBuffer({ birth: 0, death: 0, alive: 2 });
    // Simulate a previous, larger resolution leaving a tail of live-looking
    // bytes behind the 2 texels that were actually refreshed.
    buf[8] = 255;
    buf[9] = 255;
    buf[10] = 255;

    expect(sumStatsPixels(buf, 2)).toEqual({ population: 2, births: 0, deaths: 0 });
  });

  it('clamps a texelCount larger than the buffer', () => {
    const buf = makeBuffer({ birth: 0, death: 0, alive: 3 });
    expect(sumStatsPixels(buf, 999).population).toBe(3);
  });

  it('handles a zero texel count', () => {
    const buf = makeBuffer({ birth: 0, death: 0, alive: 5 });
    expect(sumStatsPixels(buf, 0)).toEqual({ population: 0, births: 0, deaths: 0 });
  });
});

describe('isStatsReadbackDue', () => {
  it('fires on the very first request so the HUD initialises promptly', () => {
    // The caller checks the cadence before incrementing its counter, so the
    // first request arrives as tick 0.
    expect(isStatsReadbackDue(0)).toBe(true);
  });

  it('fires on every Nth tick', () => {
    const interval = STATS_READBACK_INTERVAL;
    expect(isStatsReadbackDue(interval)).toBe(true);
    expect(isStatsReadbackDue(interval * 2)).toBe(true);
    expect(isStatsReadbackDue(interval * 3)).toBe(true);
  });

  it('skips intervening ticks', () => {
    for (let t = 1; t < STATS_READBACK_INTERVAL; t++) {
      expect(isStatsReadbackDue(t)).toBe(false);
    }
  });

  it('fires roughly once per interval over a long run', () => {
    // Requests are numbered from 0, matching the caller's counter.
    const ticks = 1000;
    let fires = 0;
    for (let t = 0; t < ticks; t++) {
      if (isStatsReadbackDue(t)) fires++;
    }
    expect(fires).toBe(Math.ceil(ticks / STATS_READBACK_INTERVAL));
  });

  it('honours a custom interval', () => {
    expect(isStatsReadbackDue(0, 1)).toBe(true);
    expect(isStatsReadbackDue(1, 1)).toBe(true);
    expect(isStatsReadbackDue(2, 4)).toBe(false);
    expect(isStatsReadbackDue(4, 4)).toBe(true);
  });

  it('degrades to every-tick for invalid intervals instead of never firing', () => {
    // A bad interval must not permanently freeze the HUD.
    for (const bad of [0, -1, NaN, Infinity]) {
      expect(isStatsReadbackDue(1, bad)).toBe(true);
      expect(isStatsReadbackDue(2, bad)).toBe(true);
    }
  });

  it('rounds a fractional interval down to a whole number of ticks', () => {
    // 2.7 floors to 2, so even ticks are due and odd ticks are not.
    expect(isStatsReadbackDue(1, 2.7)).toBe(false);
    expect(isStatsReadbackDue(2, 2.7)).toBe(true);
    expect(isStatsReadbackDue(3, 2.7)).toBe(false);
    expect(isStatsReadbackDue(4, 2.7)).toBe(true);
  });
});
