// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFullscreenPass } from '../../src/components/gpuSimulation/common';
import { useGpuPingPong } from '../../src/components/gpuSimulation/useGpuPingPong';
import { useGpuSeeder } from '../../src/components/gpuSimulation/useGpuSeeder';
import { PatternTextureCache } from '../../src/components/patternTextureCache';
import { createFakeGl } from './helpers/fakeGl';

type ReadStats = (c: THREE.Texture, p: THREE.Texture, force?: boolean) => void;

function setup() {
  const fake = createFakeGl();
  const simMaterial = new THREE.ShaderMaterial({ uniforms: { uTexture: { value: null } } });
  const seedMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uCurrentState: { value: null },
      uPatternData: { value: null },
      uSeedCenter: { value: new THREE.Vector2() },
      uPatternSize: { value: new THREE.Vector2() },
      uPatternOrigin: { value: new THREE.Vector2() },
      uSeedMode: { value: 0 },
      uSeedProbability: { value: 0 },
      uColonyMode: { value: false },
      uRandomSeed: { value: 0 },
    },
  });
  const simScene = createFullscreenPass(simMaterial);
  const seedScene = createFullscreenPass(seedMaterial);
  const generationRef = { current: 5 };
  const readStats = vi.fn<ReadStats>();
  const onTextureUpdate = vi.fn<(t: THREE.Texture) => void>();
  const hook = renderHook(() => {
    const pingPong = useGpuPingPong({ width: 4, height: 4 });
    const seeder = useGpuSeeder({
      gl: fake.gl,
      resolution: { width: 4, height: 4 },
      randomDensity: 0.5,
      gameMode: 'Classic',
      pingPong,
      simMaterial,
      simScene,
      seedMaterial,
      seedScene,
      generationRef,
      readStats,
      onTextureUpdate,
    });
    return { pingPong, ...seeder };
  });
  return { fake, hook, seedMaterial, generationRef, readStats, onTextureUpdate };
}

afterEach(() => vi.restoreAllMocks());

describe('useGpuSeeder', () => {
  it('initialises both targets on mount, publishes targetA and forces a stats read', () => {
    const { fake, hook, generationRef, readStats, onTextureUpdate } = setup();
    const { targetA } = hook.result.current.pingPong;
    expect(fake.mocks.render).toHaveBeenCalledTimes(2);
    expect(generationRef.current).toBe(0);
    expect(hook.result.current.pingPong.currentBufferRef.current).toBe('A');
    expect(onTextureUpdate).toHaveBeenCalledWith(targetA.texture);
    expect(readStats).toHaveBeenCalledWith(targetA.texture, targetA.texture, true);
  });

  it('re-initialises only when the render targets change, not on rerender', () => {
    const { fake, hook } = setup();
    hook.rerender();
    expect(fake.mocks.render).toHaveBeenCalledTimes(2);
  });

  it('initializeState resets generation and current buffer', () => {
    const { hook, generationRef } = setup();
    hook.result.current.pingPong.swap();
    generationRef.current = 9;
    hook.result.current.initializeState(0);
    expect(generationRef.current).toBe(0);
    expect(hook.result.current.pingPong.currentBufferRef.current).toBe('A');
  });

  it('seedAtUV renders into the write buffer, swaps, publishes and reads stats unforced', () => {
    const { hook, seedMaterial, readStats, onTextureUpdate } = setup();
    const { targetA, targetB } = hook.result.current.pingPong;
    readStats.mockClear();
    onTextureUpdate.mockClear();
    hook.result.current.seedAtUV({
      u: 0.25,
      v: 0.75,
      pattern: [[1, 0]],
      mode: 'toggle',
      originRow: 1,
      originCol: 2,
    });
    expect(seedMaterial.uniforms.uCurrentState.value).toBe(targetA.texture);
    expect(seedMaterial.uniforms.uSeedMode.value).toBe(1);
    expect(seedMaterial.uniforms.uSeedCenter.value.toArray()).toEqual([0.25, 0.75]);
    expect(seedMaterial.uniforms.uPatternSize.value.toArray()).toEqual([2, 1]);
    expect(seedMaterial.uniforms.uPatternOrigin.value.toArray()).toEqual([2, 1]);
    expect(hook.result.current.pingPong.currentBufferRef.current).toBe('B');
    expect(readStats).toHaveBeenCalledWith(targetB.texture, targetA.texture);
    expect(onTextureUpdate).toHaveBeenCalledWith(targetB.texture);
  });

  it('seedAtUV ignores empty patterns', () => {
    const { fake, hook } = setup();
    fake.mocks.render.mockClear();
    hook.result.current.seedAtUV({
      u: 0,
      v: 0,
      pattern: [],
      mode: 'set',
      originRow: 0,
      originCol: 0,
    });
    expect(fake.mocks.render).not.toHaveBeenCalled();
  });

  it('disposes the pattern cache on unmount', () => {
    const spy = vi.spyOn(PatternTextureCache.prototype, 'dispose');
    const { hook } = setup();
    hook.result.current.seedAtUV({
      u: 0,
      v: 0,
      pattern: [[1]],
      mode: 'set',
      originRow: 0,
      originCol: 0,
    });
    hook.unmount();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
