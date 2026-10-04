import { describe, expect, it } from 'vitest';

import {
  clampDpr,
  decideNextDpr,
  DEFAULT_ADAPTIVE_RESOLUTION_CONFIG as CONFIG,
  FrameRateWindow,
  roundDpr,
} from '../../src/components/performance/adaptiveResolution';

const COOLED = CONFIG.cooldownMs;

describe('roundDpr', () => {
  it('rounds to two decimals', () => {
    expect(roundDpr(1.23456)).toBe(1.23);
    expect(roundDpr(1.5678)).toBe(1.57);
    expect(roundDpr(2)).toBe(2);
  });

  it('follows float representation for exact halfway cases', () => {
    // 1.005 is stored as 1.00499... so this rounds down. Documented rather
    // than papered over, because it affects which way a partial step lands.
    expect(roundDpr(1.005)).toBe(1);
  });

  it('prevents float drift across repeated steps', () => {
    let dpr = 2;
    for (let i = 0; i < 12; i++) dpr = roundDpr(dpr - 0.1);
    expect(Number.isFinite(dpr)).toBe(true);
    expect(dpr).toBe(roundDpr(dpr));
  });
});

describe('clampDpr', () => {
  it('clamps to the configured range', () => {
    expect(clampDpr(0.25, CONFIG)).toBe(CONFIG.minDpr);
    expect(clampDpr(9, CONFIG)).toBe(CONFIG.maxDpr);
    expect(clampDpr(1.5, CONFIG)).toBe(1.5);
  });

  it('tolerates an inverted range by normalising it', () => {
    const bad = { ...CONFIG, minDpr: 2, maxDpr: 1 };
    // Normalised to [1, 2], which contains 1.5.
    expect(clampDpr(1.5, bad)).toBe(1.5);
    expect(clampDpr(3, bad)).toBe(2);
    expect(clampDpr(0, bad)).toBe(1);
  });
});

describe('decideNextDpr', () => {
  it('holds steady without enough samples', () => {
    expect(decideNextDpr(2, null, COOLED, CONFIG)).toBe(2);
  });

  it('downscales on sustained low frame rate', () => {
    expect(decideNextDpr(2, 30, COOLED, CONFIG)).toBe(1.75);
  });

  it('upscales when there is headroom', () => {
    expect(decideNextDpr(1.5, 60, COOLED, CONFIG)).toBe(1.75);
  });

  it('respects the cooldown so resolution does not jitter', () => {
    expect(decideNextDpr(2, 10, 0, CONFIG)).toBe(2);
    expect(decideNextDpr(2, 10, CONFIG.cooldownMs - 1, CONFIG)).toBe(2);
    expect(decideNextDpr(2, 10, COOLED, CONFIG)).toBe(1.75);
  });

  it('uses wall-clock cooldown, so a slow machine is not penalised', () => {
    // The same elapsed time must allow the same number of adjustments whether
    // the page is running at 60fps or at 3fps.
    const step = (ms: number, fps: number) => decideNextDpr(2, fps, ms, CONFIG);
    expect(step(500, 20)).toBe(2);
    expect(step(2000, 20)).toBe(1.75);
  });

  it('ignores a nonsensical elapsed time', () => {
    expect(decideNextDpr(2, 10, NaN, CONFIG)).toBe(2);
    expect(decideNextDpr(2, 10, Infinity, CONFIG)).toBe(2);
  });

  it('does not downscale below the floor', () => {
    expect(decideNextDpr(1, 5, COOLED, CONFIG)).toBe(1);
  });

  it('clamps a partial step onto the floor instead of ignoring it', () => {
    // Only 0.1 remains before the floor, but the reduction still matters.
    expect(decideNextDpr(1.1, 5, COOLED, CONFIG)).toBe(1);
  });

  it('does not upscale above the ceiling', () => {
    expect(decideNextDpr(2, 120, COOLED, CONFIG)).toBe(2);
  });

  it('clamps a partial step onto the ceiling instead of ignoring it', () => {
    expect(decideNextDpr(1.9, 120, COOLED, CONFIG)).toBe(2);
  });

  it('holds steady inside the hysteresis band', () => {
    // Down threshold is 48fps, up threshold is 57fps with the defaults.
    for (const fps of [49, 50, 52, 54, 56, 56.9]) {
      expect(decideNextDpr(1.5, fps, COOLED, CONFIG)).toBe(1.5);
    }
  });

  it('would oscillate without hysteresis, proving the band is load-bearing', () => {
    // Same config with the hysteresis collapsed: a rate sitting between the
    // two thresholds flips direction on every call.
    const noHysteresis = { ...CONFIG, upRatio: CONFIG.downRatio };
    let dpr = 1.5;
    const seen = new Set<number>();
    for (let i = 0; i < 6; i++) {
      dpr = decideNextDpr(dpr, 52, COOLED, noHysteresis);
      seen.add(dpr);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('is stable at a rate inside the band with hysteresis applied', () => {
    let dpr = 1.5;
    const seen = new Set<number>();
    for (let i = 0; i < 6; i++) {
      dpr = decideNextDpr(dpr, 52, COOLED, CONFIG);
      seen.add(dpr);
    }
    expect(seen.size).toBe(1);
  });

  it('ignores nonsense frame rates', () => {
    expect(decideNextDpr(1.5, 0, COOLED, CONFIG)).toBe(1.5);
    expect(decideNextDpr(1.5, -10, COOLED, CONFIG)).toBe(1.5);
    expect(decideNextDpr(1.5, NaN, COOLED, CONFIG)).toBe(1.5);
    expect(decideNextDpr(1.5, Infinity, COOLED, CONFIG)).toBe(1.5);
  });

  it('walks from ceiling to floor under sustained load', () => {
    let dpr = 2;
    for (let i = 0; i < 20 && dpr > 1; i++) {
      dpr = decideNextDpr(dpr, 20, COOLED, CONFIG);
    }
    expect(dpr).toBe(1);
  });

  it('walks back to the ceiling once load is removed', () => {
    let dpr = 1;
    for (let i = 0; i < 20 && dpr < 2; i++) {
      dpr = decideNextDpr(dpr, 90, COOLED, CONFIG);
    }
    expect(dpr).toBe(2);
  });
});

describe('FrameRateWindow', () => {
  it('reports nothing until full', () => {
    const w = new FrameRateWindow(10, 10);
    expect(w.averageFps).toBeNull();
    expect(w.isReady).toBe(false);
    for (let i = 0; i < 9; i++) w.push(1 / 60);
    expect(w.averageFps).toBeNull();
    w.push(1 / 60);
    expect(w.isReady).toBe(true);
    expect(w.averageFps).toBeCloseTo(60, 1);
  });

  it('measures a known rate', () => {
    const w = new FrameRateWindow(30, 30);
    for (let i = 0; i < 30; i++) w.push(1 / 30);
    expect(w.averageFps).toBeCloseTo(30, 1);
  });

  it('ignores non-finite and non-positive deltas', () => {
    const w = new FrameRateWindow(5, 5);
    w.push(NaN);
    w.push(Infinity);
    w.push(0);
    w.push(-1);
    expect(w.sampleCount).toBe(0);
    expect(w.averageFps).toBeNull();
  });

  it('weights a long frame by how long it actually took', () => {
    const w = new FrameRateWindow(10, 10);
    for (let i = 0; i < 9; i++) w.push(1 / 120);
    w.push(1); // a 1s stall

    // Total elapsed time is ~1.07s across 10 frames, so ~9.3fps is the honest
    // answer. A mean of 1/dt would have reported (9*120 + 1) / 10 = ~108fps,
    // badly understating a frame that blocked for a full second.
    expect(w.averageFps).toBeCloseTo(10 / (9 / 120 + 1), 1);
    expect(w.averageFps!).toBeLessThan(20);
  });

  it('drops old samples once the window rolls over', () => {
    const w = new FrameRateWindow(4, 4);
    for (let i = 0; i < 4; i++) w.push(1 / 10);
    expect(w.averageFps).toBeCloseTo(10, 1);
    for (let i = 0; i < 4; i++) w.push(1 / 100);
    expect(w.averageFps).toBeCloseTo(100, 1);
  });

  it('resets to empty', () => {
    const w = new FrameRateWindow(5, 5);
    for (let i = 0; i < 5; i++) w.push(1 / 60);
    expect(w.isReady).toBe(true);
    w.reset();
    expect(w.isReady).toBe(false);
    expect(w.sampleCount).toBe(0);
    expect(w.averageFps).toBeNull();
  });

  it('survives a zero-size window', () => {
    const w = new FrameRateWindow(0, 1);
    w.push(1 / 60);
    expect(w.isReady).toBe(true);
    expect(w.averageFps).toBeCloseTo(60, 1);
  });

  it('decides from a partial window once minSamples is reached', () => {
    // Regression guard: requiring a *full* window made the scaler take ~15s to
    // react on a 3fps machine, i.e. slowest exactly when it mattered.
    const w = new FrameRateWindow(45, 10);
    for (let i = 0; i < 9; i++) w.push(1 / 60);
    expect(w.isFull).toBe(false);
    expect(w.averageFps).toBeNull();
    w.push(1 / 60);
    expect(w.isFull).toBe(false);
    expect(w.isReady).toBe(true);
    expect(w.averageFps).toBeCloseTo(60, 1);
  });

  it('clamps a minSamples larger than the window', () => {
    const w = new FrameRateWindow(5, 99);
    for (let i = 0; i < 5; i++) w.push(1 / 60);
    expect(w.isReady).toBe(true);
    expect(w.averageFps).toBeCloseTo(60, 1);
  });
});

describe('end-to-end scaler simulation', () => {
  it('settles at the floor under a 20fps load and recovers afterwards', () => {
    const w = new FrameRateWindow(CONFIG.sampleSize, CONFIG.minSampleSize);
    let dpr = 2;
    let since = COOLED;

    const run = (fps: number, frames: number) => {
      for (let i = 0; i < frames; i++) {
        w.push(1 / fps);
        since += 1000 / fps; // ms elapsed this frame
        const next = decideNextDpr(dpr, w.averageFps, since, CONFIG);
        if (next !== dpr) {
          dpr = next;
          since = 0;
          w.reset();
        }
      }
    };

    run(20, 300);
    expect(dpr).toBe(1);

    run(90, 900);
    expect(dpr).toBe(2);
  });

  it('never oscillates around the threshold under a jittery 52fps load', () => {
    const w = new FrameRateWindow(CONFIG.sampleSize, CONFIG.minSampleSize);
    let dpr = 1.5;
    let since = COOLED;
    const seen = new Set<number>();

    for (let i = 0; i < 600; i++) {
      // Alternate between just-inside and just-outside the band.
      const fps = i % 2 === 0 ? 52 : 58;
      w.push(1 / fps);
      since += 1000 / fps; // ms elapsed this frame
      const next = decideNextDpr(dpr, w.averageFps, since, CONFIG);
      if (next !== dpr) {
        dpr = next;
        since = 0;
        w.reset();
      }
      seen.add(dpr);
    }
    expect(seen.size).toBe(1);
  });
});
