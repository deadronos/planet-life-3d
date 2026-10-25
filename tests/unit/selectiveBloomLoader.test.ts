import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadBloomEffects } from '../../src/components/postprocessing/SelectiveBloom';

describe('loadBloomEffects', () => {
  afterEach(() => vi.restoreAllMocks());

  it('passes a successful import through', async () => {
    const Effects = () => null;
    const mod = await loadBloomEffects(() => Promise.resolve({ default: Effects }));
    expect(mod.default).toBe(Effects);
  });

  it('turns a rejected import into a component that renders nothing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await loadBloomEffects(() => Promise.reject(new Error('404')));
    expect(warn).toHaveBeenCalledTimes(1);
    const Fallback = mod.default as (props: object) => unknown;
    expect(Fallback({ intensity: 1, threshold: 1, radius: 1 })).toBeNull();
  });
});
