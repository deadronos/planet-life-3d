import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';

import { PLANET_NOISE_BAKE_FRAG, PLANET_NOISE_BAKE_VERT } from '../../shaders/planetNoiseBake';
import { useUIStore } from '../../store/useUIStore';

// 2:1 equirect, RGBA8 → 8 MiB. At the default radius (2.6) the highest
// frequency (×8) spans ~16 texels per noise feature at the equator.
export const PLANET_NOISE_WIDTH = 2048;
export const PLANET_NOISE_HEIGHT = 1024;

type BakeRenderer = Pick<THREE.WebGLRenderer, 'getRenderTarget' | 'setRenderTarget' | 'render'>;

/** Allocates the (empty) equirect target the noise is baked into. */
export function createPlanetNoiseTarget(
  width = PLANET_NOISE_WIDTH,
  height = PLANET_NOISE_HEIGHT,
): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
    stencilBuffer: false,
  });
  // Longitude wraps (no seam at atan's ±π); latitude clamps at the poles.
  target.texture.wrapS = THREE.RepeatWrapping;
  target.texture.wrapT = THREE.ClampToEdgeWrapping;
  target.texture.name = 'PlanetSurfaceNoise';
  return target;
}

/**
 * Renders the static surface noise for a planet of `planetRadius` into
 * `target`. Render-target contents do not survive a WebGL context loss, so
 * re-bake after a restore.
 */
export function bakePlanetNoise(
  gl: BakeRenderer,
  target: THREE.WebGLRenderTarget,
  planetRadius: number,
): void {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: { uRadius: { value: planetRadius } },
    vertexShader: PLANET_NOISE_BAKE_VERT,
    fragmentShader: PLANET_NOISE_BAKE_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(geometry, material);
  quad.frustumCulled = false;
  scene.add(quad);
  const camera = new THREE.Camera();

  const previous = gl.getRenderTarget();
  try {
    gl.setRenderTarget(target);
    gl.render(scene, camera);
  } finally {
    gl.setRenderTarget(previous);
    geometry.dispose();
    material.dispose();
  }
}

/**
 * Baked surface-noise texture for the planet material. The target is
 * re-created after a WebGL context restore (`graphicsEpoch`) and re-baked only
 * when the planet radius (the noise field's only input) or the context changes.
 */
export function usePlanetNoiseTexture(planetRadius: number): THREE.Texture {
  const gl = useThree((state) => state.gl);
  const graphicsEpoch = useUIStore((state) => state.graphicsEpoch);
  // graphicsEpoch is a deliberate dep: a fresh target per restored context.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const target = useMemo(() => createPlanetNoiseTarget(), [graphicsEpoch]);

  useEffect(() => () => target.dispose(), [target]);

  // Layout effect so the first frame already samples baked noise.
  useLayoutEffect(() => {
    bakePlanetNoise(gl, target, planetRadius);
  }, [gl, target, planetRadius]);

  return target.texture;
}
