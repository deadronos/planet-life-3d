import { act, renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const gl = {
  getRenderTarget: vi.fn(() => null),
  setRenderTarget: vi.fn(),
  render: vi.fn(),
};

vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (state: { gl: typeof gl }) => unknown) => selector({ gl }),
}));

import {
  bakePlanetNoise,
  createPlanetNoiseTarget,
  PLANET_NOISE_HEIGHT,
  PLANET_NOISE_WIDTH,
  usePlanetNoiseTexture,
} from '../../src/components/planetLife/planetNoiseTexture';
import { useUIStore } from '../../src/store/useUIStore';

describe('planet noise bake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allocates a 2:1 RGBA8 equirect target without mipmaps, wrapping longitude only', () => {
    const target = createPlanetNoiseTarget();
    expect(target.width).toBe(PLANET_NOISE_WIDTH);
    expect(target.height).toBe(PLANET_NOISE_HEIGHT);
    expect(target.texture.type).toBe(THREE.UnsignedByteType);
    expect(target.texture.generateMipmaps).toBe(false);
    expect(target.texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(target.texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
    target.dispose();
  });

  it('renders once into the target, restores the previous target and frees bake resources', () => {
    const previous = new THREE.WebGLRenderTarget(1, 1);
    gl.getRenderTarget.mockReturnValueOnce(previous as never);
    const disposeGeometry = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    const disposeMaterial = vi.spyOn(THREE.Material.prototype, 'dispose');
    const target = createPlanetNoiseTarget(4, 2);

    bakePlanetNoise(gl, target, 2.6);

    expect(gl.render).toHaveBeenCalledTimes(1);
    expect(gl.setRenderTarget.mock.calls).toEqual([[target], [previous]]);
    const material = (gl.render.mock.calls[0][0] as THREE.Scene).children[0] as THREE.Mesh;
    expect((material.material as THREE.ShaderMaterial).uniforms.uRadius.value).toBe(2.6);
    expect(disposeGeometry).toHaveBeenCalled();
    expect(disposeMaterial).toHaveBeenCalled();
    disposeGeometry.mockRestore();
    disposeMaterial.mockRestore();
  });

  it('re-bakes on radius change and swaps/disposes the target after a context restore', () => {
    const { result, rerender, unmount } = renderHook(({ r }) => usePlanetNoiseTexture(r), {
      initialProps: { r: 2.6 },
    });
    expect(gl.render).toHaveBeenCalledTimes(1);
    const first = result.current;

    rerender({ r: 2.6 });
    expect(gl.render).toHaveBeenCalledTimes(1);

    rerender({ r: 3 });
    expect(gl.render).toHaveBeenCalledTimes(2);
    expect(result.current).toBe(first);

    const firstTarget = gl.setRenderTarget.mock.calls[0][0] as THREE.WebGLRenderTarget;
    const disposeSpy = vi.spyOn(firstTarget, 'dispose');
    act(() => useUIStore.getState().bumpGraphicsEpoch());
    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(gl.render).toHaveBeenCalledTimes(3);
    expect(result.current).not.toBe(first);

    const secondTarget = gl.setRenderTarget.mock.calls.at(-2)?.[0] as THREE.WebGLRenderTarget;
    const disposeSecond = vi.spyOn(secondTarget, 'dispose');
    unmount();
    expect(disposeSecond).toHaveBeenCalledTimes(1);
  });
});
