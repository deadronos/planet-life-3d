// @vitest-environment jsdom
/**
 * Integration test: the real GPUSimulation component (all four hooks wired
 * together) mounted in a real R3F root via @react-three/test-renderer. Only
 * the renderer's GPU entry points are stubbed, so that the pass ordering,
 * ping-pong swap, texture publication and stats epoch run for real - the
 * hook-level tests in tests/unit cover each hook in isolation, and
 * tests/component/GPUSimulation.test.tsx mocks R3F entirely.
 */
import type * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { GPUSimulationHandle } from '../../src/components/GPUSimulation';
import type { GpuStats } from '../../src/components/gpuSimulation/useGpuStatsReadback';
import { createFakeGl } from '../unit/helpers/fakeGl';

// Real R3F (reconciler, store, useFrame loop) with only `gl` swapped for the
// shared fake: the test-renderer's own gl is a bare stand-in without the
// render-target API the simulation drives.
const fake = createFakeGl({ async: false });
vi.doMock('@react-three/fiber', async () => {
  const actual = await vi.importActual<typeof import('@react-three/fiber')>('@react-three/fiber');
  return {
    ...actual,
    useThree: ((selector?: (s: unknown) => unknown) => {
      const state = { ...actual.useThree(), gl: fake.gl };
      return selector ? selector(state) : state;
    }) as typeof actual.useThree,
  };
});

let create: typeof import('@react-three/test-renderer').create;
let act: typeof import('@react-three/test-renderer').act;

beforeAll(async () => {
  const rtr = await import('@react-three/test-renderer');
  create = rtr.create;
  act = rtr.act;
});

afterEach(() => vi.clearAllMocks());

const RULES = {
  birth: [false, false, false, true, false, false, false, false, false],
  survive: [false, false, true, true, false, false, false, false, false],
};

const flush = () => new Promise((r) => setTimeout(r, 0));

async function mount(opts: { running?: boolean } = {}) {
  const { default: React } = await import('react');
  const { GPUSimulation } = await import('../../src/components/GPUSimulation');

  const { mocks } = fake;
  mocks.readRenderTargetPixels.mockImplementation(
    (_t: unknown, _x: number, _y: number, _w: number, _h: number, buf: Uint8Array) => {
      buf[0] = 255; // birth
      buf[2] = 255; // alive
    },
  );

  const stats: GpuStats[] = [];
  const textures: THREE.Texture[] = [];
  const simRef = React.createRef<GPUSimulationHandle>();

  const renderer = await create(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(GPUSimulation, {
        resolution: { width: 4, height: 4 },
        rules: RULES,
        running: opts.running ?? false,
        tickMs: 1,
        randomDensity: 0.5,
        simRef,
        onStats: (s: GpuStats) => stats.push(s),
        onTextureUpdate: (t: THREE.Texture) => textures.push(t),
      }),
    ),
  );
  return { renderer, simRef, stats, textures, render: mocks.render, act };
}

describe('GPUSimulation (real R3F root)', () => {
  it('stepOnce renders a pass, publishes the written texture and reports stats', async () => {
    const m = await mount();
    await act(async () => {
      await flush();
    });
    m.stats.length = 0;
    m.textures.length = 0;
    m.render.mockClear();

    await act(async () => {
      m.simRef.current?.stepOnce();
      await flush();
    });

    expect(m.render).toHaveBeenCalled();
    expect(m.textures).toHaveLength(1);
    expect(fake.mocks.readRenderTargetPixels).toHaveBeenCalled();
    const last = m.stats[m.stats.length - 1];
    expect(last).toMatchObject({ population: 1, birthsLastTick: 1, deathsLastTick: 0 });
    expect(last.generation).toBeGreaterThanOrEqual(1);

    // Ping-pong: consecutive steps publish different textures.
    await act(async () => {
      m.simRef.current?.stepOnce();
      await flush();
    });
    expect(m.textures).toHaveLength(2);
    expect(m.textures[1]).not.toBe(m.textures[0]);

    await m.renderer.unmount();
  });

  it('clear resets the generation counter reported by stats', async () => {
    const m = await mount();
    await act(async () => {
      m.simRef.current?.stepOnce();
      m.simRef.current?.stepOnce();
      await flush();
    });
    await act(async () => {
      m.simRef.current?.clear();
      await flush();
    });
    expect(m.stats[m.stats.length - 1].generation).toBe(0);
    await m.renderer.unmount();
  });

  it('does not tick on frames while paused, and ticks when running', async () => {
    const paused = await mount({ running: false });
    paused.textures.length = 0;
    await act(async () => {
      await paused.renderer.advanceFrames(3, 0.2);
    });
    expect(paused.textures).toHaveLength(0);
    await paused.renderer.unmount();

    const running = await mount({ running: true });
    running.textures.length = 0;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
      await running.renderer.advanceFrames(3, 0.2);
    });
    expect(running.textures.length).toBeGreaterThan(0);
    await running.renderer.unmount();
  });
});
