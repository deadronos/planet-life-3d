import { describe, expect, it } from 'vitest';

import {
  clampFrameDelta,
  MAX_ANIMATION_DELTA_SECONDS,
  needsContinuousRender,
} from '../../src/components/performance/renderDemand';

const idle = { simRunning: false, autoRotate: false, activeEffects: 0, documentHidden: false };

describe('needsContinuousRender', () => {
  it('is false when nothing animates', () => {
    expect(needsContinuousRender(idle)).toBe(false);
  });
  it.each([{ simRunning: true }, { autoRotate: true }, { activeEffects: 2 }])(
    'is true for %o',
    (patch) => {
      expect(needsContinuousRender({ ...idle, ...patch })).toBe(true);
    },
  );
  it('is false while the document is hidden', () => {
    expect(needsContinuousRender({ ...idle, simRunning: true, documentHidden: true })).toBe(false);
  });
});

describe('clampFrameDelta', () => {
  it('clamps idle gaps and rejects bad values', () => {
    expect(clampFrameDelta(5)).toBe(MAX_ANIMATION_DELTA_SECONDS);
    expect(clampFrameDelta(0.016)).toBe(0.016);
    expect(clampFrameDelta(-1)).toBe(0);
    expect(clampFrameDelta(NaN)).toBe(0);
  });
});
