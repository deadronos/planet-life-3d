// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { usePlanetMaterial } from '../../src/components/planetLife/planetMaterial';

type Props = Parameters<typeof usePlanetMaterial>[0];

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    atmosphereColor: '#4488ff',
    rimIntensity: 0.8,
    rimPower: 3.0,
    terminatorSharpness: 4.0,
    terminatorBoost: 0.1,
    planetRoughness: 0.5,
    planetWireframe: false,
    ecologyIntensity: 0.6,
    latCells: 64,
    lonCells: 128,
    lightPosition: [10, 0, 0],
    noiseTexture: new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1),
    ...overrides,
  };
}

describe('usePlanetMaterial', () => {
  it('updates uniforms and wireframe in place without recreating the ShaderMaterial', () => {
    const initial = makeProps();
    const { result, rerender, unmount } = renderHook((p: Props) => usePlanetMaterial(p), {
      initialProps: initial,
    });
    const firstMaterial = result.current;

    rerender(
      makeProps({
        noiseTexture: initial.noiseTexture,
        atmosphereColor: '#ff3366',
        rimIntensity: 1.5,
        rimPower: 2.0,
        terminatorSharpness: 8.0,
        terminatorBoost: 0.35,
        planetRoughness: 0.8,
        planetWireframe: true,
        ecologyIntensity: 0.25,
        latCells: 80,
        lonCells: 160,
        lightPosition: [0, 10, 0],
      }),
    );

    expect(result.current).toBe(firstMaterial);
    expect(firstMaterial.wireframe).toBe(true);
    expect(firstMaterial.uniforms.uRimColor.value.getHexString()).toBe('ff3366');
    expect(firstMaterial.uniforms.uRimIntensity.value).toBe(1.5);
    expect(firstMaterial.uniforms.uRimPower.value).toBe(2.0);
    expect(firstMaterial.uniforms.uTerminatorSharpness.value).toBe(8.0);
    expect(firstMaterial.uniforms.uTerminatorBoost.value).toBe(0.35);
    expect(firstMaterial.uniforms.uRoughnessBase.value).toBe(0.8);
    expect(firstMaterial.uniforms.uEcologyIntensity.value).toBe(0.25);
    expect(firstMaterial.uniforms.uGridSize.value.toArray()).toEqual([160, 80]);
    expect(firstMaterial.uniforms.uLightDir.value.toArray()).toEqual([0, 1, 0]);

    unmount();
    initial.noiseTexture.dispose();
  });
});
