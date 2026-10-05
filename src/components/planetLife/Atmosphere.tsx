import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Sphere tessellation used for the planet and its atmosphere shell.
 *
 * 64 segments leaves visible straight edges along the silhouette against a
 * dark sky. Vertex cost is negligible next to the fragment cost of the planet
 * shader, so the segments are raised rather than left low.
 */
export const PLANET_SPHERE_SEGMENTS = 128;

export interface AtmosphereProps {
  planetRadius: number;
  atmosphereColor: string;
  atmosphereIntensity: number;
  atmosphereHeight: number;
  /** Fresnel falloff exponent; higher is tighter to the limb. */
  atmospherePower?: number;
}

const atmosphereVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

/**
 * Limb-concentrated falloff.
 *
 * `facing` is 1 where the surface looks straight at the camera (the middle of
 * the disc) and falls to 0 at the silhouette. Inverting and raising it to a
 * power concentrates the glow at the edge, which is what reads as an
 * atmosphere - a ray grazing the limb travels through far more air than one
 * through the centre of the disc.
 *
 * The previous meshBasicMaterial had no view-dependent term at all, so every
 * fragment contributed exactly the same amount and the shell rendered as a
 * uniformly tinted bubble.
 */
const atmosphereFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uPower;

  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
    float limb = pow(1.0 - clamp(facing, 0.0, 1.0), uPower);
    float alpha = clamp(uIntensity, 0.0, 1.0) * limb;
    // Additive blending multiplies by src alpha, so the falloff rides on the
    // alpha and the colour keeps its saturation.
    gl_FragColor = vec4(uColor, alpha);
  }
`;

type AtmosphereUniforms = {
  uColor: { value: THREE.Color };
  uIntensity: { value: number };
  uPower: { value: number };
};

type AtmosphereMaterial = THREE.ShaderMaterial & { uniforms: AtmosphereUniforms };

export function Atmosphere({
  planetRadius,
  atmosphereColor,
  atmosphereIntensity,
  atmosphereHeight,
  atmospherePower = 3,
}: AtmosphereProps) {
  // Created once; every uniform is mutated in place below so tweaking a
  // slider never rebuilds the material.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(atmosphereColor) },
          uIntensity: { value: Math.max(0, atmosphereIntensity) * 0.35 },
          uPower: { value: atmospherePower },
        },
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide,
      }) as AtmosphereMaterial,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Update uniforms in place rather than recreating the material, so dragging
  // the atmosphere sliders does not churn GPU resources. Mutating three.js
  // uniforms is the established pattern in this codebase (see LifeOverlay).
  useEffect(() => {
    material.uniforms.uColor.value.set(atmosphereColor);
    // eslint-disable-next-line react-hooks/immutability
    material.uniforms.uIntensity.value = Math.max(0, atmosphereIntensity) * 0.35;

    material.uniforms.uPower.value = atmospherePower;
  }, [atmosphereColor, atmosphereIntensity, atmospherePower, material]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <mesh raycast={() => null} material={material}>
      <sphereGeometry
        args={[
          planetRadius * (1 + atmosphereHeight),
          PLANET_SPHERE_SEGMENTS,
          PLANET_SPHERE_SEGMENTS,
        ]}
      />
    </mesh>
  );
}
