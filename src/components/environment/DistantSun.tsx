import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { DISPLAY_REFERRED_OUTPUT } from '../../shaders/displayReferredOutput';

interface DistantSunProps {
  position?: [number, number, number];
  /** Radius of the bright core, in world units. The corona extends past it. */
  size?: number;
}

/** Corona radius as a multiple of the core radius (the billboard half-size). */
const CORONA_SCALE = 3;

/**
 * A distant star that serves as the visible source for the lens flare.
 *
 * Drawn as one camera-facing quad with a radial falloff: a small warm-white
 * core that is the only part pushed past 1.0 (so selective bloom adds a tight
 * glow), fading through an orange fringe into a soft corona. There is no hard
 * disc edge, so it still reads as a star with bloom off.
 */
export function DistantSun({ position = [60, 60, 80], size = 3 }: DistantSunProps) {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uCore: { value: new THREE.Color('#fffaf0') },
        uFringe: { value: new THREE.Color('#ffb060') },
        uCorona: { value: new THREE.Color('#ff8a3d') },
        // Core radius in the quad's normalised [0, 1] radius.
        uCoreRadius: { value: 1 / CORONA_SCALE },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uCore;
        uniform vec3 uFringe;
        uniform vec3 uCorona;
        uniform float uCoreRadius;
        varying vec2 vUv;

        void main() {
          float r = length(vUv - 0.5) * 2.0;
          float rc = r / uCoreRadius;
          // Bright core: smooth plateau that only exceeds 1.0 near the centre.
          float core = exp(-rc * rc * 4.0);
          // Narrow orange fringe just outside the core.
          float fringe = exp(-rc * rc * 0.9);
          // Soft, wide corona that reaches zero at the quad edge.
          float corona = pow(max(0.0, 1.0 - r), 3.0);

          vec3 color = uCore * core * 2.2 + uFringe * fringe * 0.35 + uCorona * corona * 0.12;
          float alpha = clamp(core + fringe * 0.6 + corona * 0.25, 0.0, 1.0);
          if (alpha < 0.002) discard;
          gl_FragColor = vec4(color, alpha);
          ${DISPLAY_REFERRED_OUTPUT}
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  const meshRef = useRef<THREE.Mesh>(null);
  // Billboard: keep the quad facing the camera.
  useFrame(({ camera }) => {
    meshRef.current?.quaternion.copy(camera.quaternion);
  });

  const extent = size * CORONA_SCALE * 2;

  return (
    <mesh ref={meshRef} position={position} material={material}>
      <planeGeometry args={[extent, extent]} />
    </mesh>
  );
}
