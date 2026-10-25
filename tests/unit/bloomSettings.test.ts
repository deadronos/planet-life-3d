import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BLOOM_MAX_DPR,
  BLOOM_MIN_DPR_FRACTION,
  DEFAULT_BLOOM_SETTINGS,
  defaultBloomEnabled,
  maxDprFor,
  shouldRenderBloom,
} from '../../src/components/postprocessing/bloomSettings';

describe('bloomSettings', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('defaults keep the threshold at the HDR boundary', () => {
    expect(DEFAULT_BLOOM_SETTINGS.threshold).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_BLOOM_SETTINGS.intensity).toBeGreaterThan(0);
  });

  it('is off when the toggle is off', () => {
    expect(shouldRenderBloom(false, 2, 2)).toBe(false);
  });

  it('runs at full pixel ratio and pauses once adaptive DPR has cut it', () => {
    expect(shouldRenderBloom(true, 2, 2)).toBe(true);
    expect(shouldRenderBloom(true, 2 * BLOOM_MIN_DPR_FRACTION, 2)).toBe(true);
    expect(shouldRenderBloom(true, 1.25, 2)).toBe(false);
    expect(shouldRenderBloom(true, 1, 1)).toBe(true);
  });

  it('tolerates a missing max pixel ratio', () => {
    expect(shouldRenderBloom(true, 1, 0)).toBe(true);
  });

  it('caps the pixel ratio only while bloom is on', () => {
    expect(maxDprFor(true, 2)).toBe(BLOOM_MAX_DPR);
    expect(maxDprFor(false, 2)).toBe(2);
    expect(maxDprFor(true, 3)).toBe(BLOOM_MAX_DPR);
    expect(maxDprFor(false, 3)).toBe(2);
    expect(maxDprFor(true, 1)).toBe(1);
    expect(maxDprFor(true, 0)).toBe(1);
  });

  it('defaults off on coarse-pointer devices', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('coarse') }));
    expect(defaultBloomEnabled()).toBe(false);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(defaultBloomEnabled()).toBe(true);
  });
});
