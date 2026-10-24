import { afterEach, describe, expect, it, vi } from 'vitest';

import { prefersReducedMotion } from '../../src/utils/reducedMotion';

describe('prefersReducedMotion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reflects the prefers-reduced-motion media query', () => {
    const matchMedia = vi.fn((query: string) => ({ matches: query.includes('reduce') }));
    vi.stubGlobal('matchMedia', matchMedia);
    expect(prefersReducedMotion()).toBe(true);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(prefersReducedMotion()).toBe(false);
  });

  it('is false when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
  });
});
