import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export function usePlanetMaterial(params: {
  atmosphereColor: string;
  rimIntensity: number;
  rimPower: number;
  terminatorSharpness: number;
  terminatorBoost: number;
  planetRoughness: number;
  planetWireframe: boolean;
}): THREE.ShaderMaterial {
  const planetMaterial = useMemo(() => {
    const lightDir = new THREE.Vector3(6, 6, 8).normalize();
    const ambientFloor = THREE.MathUtils.clamp(params.planetRoughness * 0.65, 0.05, 0.95);

    const uniforms = {
      uDayColor: { value: new THREE.Color('#1a1f2a') },
      uNightColor: { value: new THREE.Color('#0c0e15') },
      uRimColor: { value: new THREE.Color(params.atmosphereColor) },
      uLightDir: { value: lightDir },
      uRimPower: { value: params.rimPower },
      uRimIntensity: { value: params.rimIntensity },
      uTerminatorSharpness: { value: params.terminatorSharpness },
      uTerminatorBoost: { value: params.terminatorBoost },
      uAmbientFloor: { value: ambientFloor },
    } satisfies Record<string, { value: THREE.Vector3 | THREE.Color | number }>;

    const material = new THREE.ShaderMaterial({
      uniforms,
      wireframe: params.planetWireframe,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uDayColor;
        uniform vec3 uNightColor;
        uniform vec3 uRimColor;
        uniform vec3 uLightDir;
        uniform float uRimPower;
        uniform float uRimIntensity;
        uniform float uTerminatorSharpness;
        uniform float uTerminatorBoost;
        uniform float uAmbientFloor;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec3 n = normalize(vNormal);
          vec3 l = normalize(uLightDir);
          float ndl = max(0.0, dot(n, l));
          float shade = pow(ndl, uTerminatorSharpness);
          shade = max(shade, uAmbientFloor);
          shade = clamp(shade * (1.0 + uTerminatorBoost), 0.0, 1.0);
          vec3 base = mix(uNightColor, uDayColor, shade);
          float rim = pow(1.0 - max(0.0, dot(n, normalize(vViewDir))), uRimPower) * uRimIntensity;
          vec3 color = base + rim * uRimColor;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    material.toneMapped = true;
    material.depthWrite = true;
    return material;
  }, [
    params.atmosphereColor,
    params.rimIntensity,
    params.rimPower,
    params.terminatorSharpness,
    params.terminatorBoost,
    params.planetRoughness,
    params.planetWireframe,
  ]);

  useEffect(() => {
    return () => planetMaterial.dispose();
  }, [planetMaterial]);

  return planetMaterial;
}
