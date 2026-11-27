// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useGpuSimMaterials } from '../../src/components/gpuSimulation/useGpuSimMaterials';
import { ECOLOGY_PROFILES } from '../../src/sim/ecology';
import type { Rules } from '../../src/sim/rules';

const rules = (birth: number[]): Rules => ({
  birth: Array.from({ length: 9 }, (_, i) => birth.includes(i)),
  survive: Array.from({ length: 9 }, (_, i) => i === 2 || i === 3),
});

type Props = Parameters<typeof useGpuSimMaterials>[0];
const base: Props = {
  resolution: { width: 8, height: 4 },
  rules: rules([3]),
  gameMode: 'Classic',
  ecologyProfile: 'None',
};

afterEach(() => vi.restoreAllMocks());

describe('useGpuSimMaterials', () => {
  it('syncs rules, game mode and ecology in place without recreating materials', () => {
    const { result, rerender } = renderHook((p: Props) => useGpuSimMaterials(p), {
      initialProps: base,
    });
    const sim = result.current.simMaterial;
    const seed = result.current.seedMaterial;
    const initialBiasTex = sim.uniforms.uEcologyBiasTexture.value as THREE.DataTexture;
    expect(sim.uniforms.uBirthRules.value).toEqual([0, 0, 0, 1, 0, 0, 0, 0, 0]);
    expect(initialBiasTex).toBeInstanceOf(THREE.DataTexture);
    expect(initialBiasTex.minFilter).toBe(THREE.NearestFilter);
    expect(initialBiasTex.magFilter).toBe(THREE.NearestFilter);

    const disposeSpy = vi.spyOn(initialBiasTex, 'dispose');
    const profileName = (Object.keys(ECOLOGY_PROFILES).find((k) => k !== 'None') ??
      'None') as Props['ecologyProfile'];
    rerender({
      ...base,
      rules: { ...rules([3, 6]), decayStates: 4 },
      gameMode: 'Colony',
      ecologyProfile: profileName,
      colonyBiomeAffinity: true,
    });

    const nextBiasTex = sim.uniforms.uEcologyBiasTexture.value as THREE.DataTexture;
    expect(result.current.simMaterial).toBe(sim);
    expect(result.current.seedMaterial).toBe(seed);
    expect(sim.uniforms.uBirthRules.value[6]).toBe(1);
    expect(sim.uniforms.uDecayStates.value).toBe(4);
    expect(sim.uniforms.uColonyMode.value).toBe(true);
    expect(sim.uniforms.uColonyBiomeAffinity.value).toBe(true);
    expect(sim.uniforms.uGeneration.value).toBe(0);
    expect(seed.uniforms.uColonyMode.value).toBe(true);
    expect(sim.uniforms.uEcologyEnabled.value).toBe(profileName !== 'None');
    expect(nextBiasTex).toBeInstanceOf(THREE.DataTexture);
    expect(nextBiasTex).not.toBe(initialBiasTex);
    expect(nextBiasTex.image.width).toBe(base.resolution.width);
    expect(nextBiasTex.image.height).toBe(base.resolution.height);
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  it('syncs polarWrap uniform in place without recreating materials', () => {
    const { result, rerender } = renderHook((p: Props) => useGpuSimMaterials(p), {
      initialProps: base,
    });
    const sim = result.current.simMaterial;
    expect(sim.uniforms.uPolarWrap.value).toBe(false);

    rerender({ ...base, polarWrap: true });

    expect(result.current.simMaterial).toBe(sim);
    expect(sim.uniforms.uPolarWrap.value).toBe(true);
  });

  it('recreates sim/seed materials only on resolution change and disposes the old ones', () => {
    const matSpy = vi.spyOn(THREE.ShaderMaterial.prototype, 'dispose');
    const geoSpy = vi.spyOn(THREE.PlaneGeometry.prototype, 'dispose');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, rerender } = renderHook((p: Props) => useGpuSimMaterials(p), {
      initialProps: base,
    });
    const first = result.current;
    rerender({ ...base, resolution: { width: 16, height: 4 } });
    expect(result.current.simMaterial).not.toBe(first.simMaterial);
    expect(result.current.statsMaterial).toBe(first.statsMaterial);
    expect(matSpy.mock.contexts).toEqual(
      expect.arrayContaining([first.simMaterial, first.seedMaterial]),
    );
    expect(matSpy.mock.contexts).not.toContain(first.statsMaterial);
    expect(geoSpy.mock.contexts).toContain(first.simScene.quad.geometry);
    expect(err).not.toHaveBeenCalled(); // resolution change is a legitimate recreate
  });

  it('disposes every material, quad geometry, and ecology bias texture on unmount', () => {
    const matSpy = vi.spyOn(THREE.ShaderMaterial.prototype, 'dispose');
    const geoSpy = vi.spyOn(THREE.PlaneGeometry.prototype, 'dispose');
    const texSpy = vi.spyOn(THREE.DataTexture.prototype, 'dispose');
    const { result, unmount } = renderHook((p: Props) => useGpuSimMaterials(p), {
      initialProps: base,
    });
    const r = result.current;
    const biasTex = r.simMaterial.uniforms.uEcologyBiasTexture.value as THREE.DataTexture;
    unmount();
    expect(matSpy.mock.contexts).toEqual(
      expect.arrayContaining([r.simMaterial, r.seedMaterial, r.copyMaterial, r.statsMaterial]),
    );
    expect(geoSpy.mock.contexts).toEqual(
      expect.arrayContaining([
        r.simScene.quad.geometry,
        r.seedScene.quad.geometry,
        r.copyScene.quad.geometry,
        r.statsScene.quad.geometry,
      ]),
    );
    expect(texSpy.mock.contexts).toContain(biasTex);
  });

  it('uses a passthrough copy shader that does not evaluate CA rules', () => {
    const { result } = renderHook((p: Props) => useGpuSimMaterials(p), {
      initialProps: base,
    });
    expect(result.current.copyMaterial.fragmentShader).toContain('texture2D(uTexture, vUv)');
    expect(result.current.copyMaterial.fragmentShader).not.toContain('uBirthRules');
  });
});
