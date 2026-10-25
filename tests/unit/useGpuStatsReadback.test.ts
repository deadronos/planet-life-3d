// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFullscreenPass } from '../../src/components/gpuSimulation/common';
import {
  type GpuStats,
  useGpuStatsReadback,
} from '../../src/components/gpuSimulation/useGpuStatsReadback';
import { STATS_READBACK_INTERVAL } from '../../src/components/planetLife/gpuStats';
import { createFakeGl } from './helpers/fakeGl';

const tex = () => new THREE.Texture();
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(opts: { async?: boolean; onStats?: ((s: GpuStats) => void) | null } = {}) {
  const fake = createFakeGl({ async: opts.async });
  const material = new THREE.ShaderMaterial({
    uniforms: { uPrevState: { value: null }, uCurrentState: { value: null } },
  });
  const scene = createFullscreenPass(material);
  const generationRef = { current: 7 };
  const onStats =
    opts.onStats === null ? undefined : (opts.onStats ?? vi.fn<(s: GpuStats) => void>());
  type P = { w: number };
  const hook = renderHook(
    ({ w }: P) =>
      useGpuStatsReadback({
        gl: fake.gl,
        resolution: { width: w, height: 2 },
        onStats,
        statsMaterial: material,
        statsScene: scene,
        generationRef,
      }),
    { initialProps: { w: 2 } },
  );
  return { fake, hook, onStats, generationRef };
}

afterEach(() => vi.restoreAllMocks());

describe('useGpuStatsReadback', () => {
  it('does nothing without an onStats consumer', () => {
    const { fake, hook } = setup({ onStats: null });
    hook.result.current.readStats(tex(), tex(), true);
    expect(fake.mocks.render).not.toHaveBeenCalled();
  });

  it('throttles to every Nth request; the first is due, force bypasses', () => {
    const { fake, hook } = setup();
    const { readStats } = hook.result.current;
    for (let i = 0; i < STATS_READBACK_INTERVAL; i++) readStats(tex(), tex());
    expect(fake.mocks.readRenderTargetPixels).toHaveBeenCalledTimes(1);
    readStats(tex(), tex()); // tick 8: due
    expect(fake.mocks.readRenderTargetPixels).toHaveBeenCalledTimes(2);
    readStats(tex(), tex(), true);
    expect(fake.mocks.readRenderTargetPixels).toHaveBeenCalledTimes(3);
  });

  it('publishes totals with the generation at request time (sync path)', () => {
    const { fake, hook, onStats } = setup();
    fake.mocks.readRenderTargetPixels.mockImplementation(
      (_t: unknown, _x: number, _y: number, _w: number, _h: number, buf: Uint8Array) => {
        buf[0] = 255; // birth
        buf[2] = 255; // alive
      },
    );
    hook.result.current.readStats(tex(), tex(), true);
    expect(onStats).toHaveBeenCalledWith({
      generation: 7,
      population: 1,
      birthsLastTick: 1,
      deathsLastTick: 0,
    });
  });

  it('defers a request made while a read is in flight and re-issues it once', async () => {
    const { fake, hook, onStats } = setup({ async: true });
    const { readStats } = hook.result.current;
    readStats(tex(), tex(), true);
    readStats(tex(), tex(), true);
    readStats(tex(), tex(), true); // replaces the pending slot
    expect(fake.mocks.readRenderTargetPixelsAsync).toHaveBeenCalledTimes(1);
    fake.pendingReads[0].resolve();
    await flush();
    expect(fake.mocks.readRenderTargetPixelsAsync).toHaveBeenCalledTimes(2);
    expect(onStats).toHaveBeenCalledTimes(1);
    fake.pendingReads[1].resolve();
    await flush();
    expect(onStats).toHaveBeenCalledTimes(2);
    expect(fake.mocks.readRenderTargetPixelsAsync).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale readback after a resolution change and drops its deferred work', async () => {
    const { fake, hook, onStats } = setup({ async: true });
    hook.result.current.readStats(tex(), tex(), true);
    hook.result.current.readStats(tex(), tex(), true); // deferred
    hook.rerender({ w: 4 });
    fake.pendingReads[0].resolve();
    await flush();
    expect(onStats).not.toHaveBeenCalled();
    expect(fake.mocks.readRenderTargetPixelsAsync).toHaveBeenCalledTimes(1);
    // lock released: a fresh request goes through on the new targets
    hook.result.current.readStats(tex(), tex(), true);
    expect(fake.mocks.readRenderTargetPixelsAsync).toHaveBeenCalledTimes(2);
  });

  it('does not publish or re-issue after unmount, and survives a failed readback', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { fake, hook, onStats } = setup({ async: true });
    hook.result.current.readStats(tex(), tex(), true);
    hook.result.current.readStats(tex(), tex(), true);
    hook.unmount();
    fake.pendingReads[0].resolve();
    await flush();
    expect(onStats).not.toHaveBeenCalled();
    expect(fake.mocks.readRenderTargetPixelsAsync).toHaveBeenCalledTimes(1);

    const b = setup({ async: true });
    b.hook.result.current.readStats(tex(), tex(), true);
    b.fake.pendingReads[0].reject(new Error('boom'));
    await flush();
    expect(warn).toHaveBeenCalled();
    b.hook.result.current.readStats(tex(), tex(), true); // lock released
    expect(b.fake.mocks.readRenderTargetPixelsAsync).toHaveBeenCalledTimes(2);
  });

  it('disposes the stats target on resolution change and unmount', () => {
    const spy = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose');
    const { hook } = setup();
    const first = hook.result.current.statsTarget;
    hook.rerender({ w: 4 });
    expect(spy.mock.contexts).toContain(first);
    const second = hook.result.current.statsTarget;
    expect(second).not.toBe(first);
    hook.unmount();
    expect(spy.mock.contexts).toContain(second);
  });
});
