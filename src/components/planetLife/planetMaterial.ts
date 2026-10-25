import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import { DISPLAY_REFERRED_OUTPUT } from '../../shaders/displayReferredOutput';
import { PLANET_NOISE_EQUIRECT_GLSL } from '../../shaders/planetNoiseBake';

export function usePlanetMaterial(params: {
  atmosphereColor: string;
  rimIntensity: number;
  rimPower: number;
  terminatorSharpness: number;
  terminatorBoost: number;
  planetRoughness: number;
  planetWireframe: boolean;
  ecologyIntensity: number;
  latCells: number;
  lonCells: number;
  lightPosition: [number, number, number];
  /** Baked surface noise from usePlanetNoiseTexture (stable per GL context). */
  noiseTexture: THREE.Texture;
}): THREE.ShaderMaterial {
  const planetMaterial = useMemo(() => {
    // Standard directional light
    const lightDir = new THREE.Vector3(...params.lightPosition).normalize();
    // Base ambient to ensure the night side isn't pitch black
    const ambientFloor = THREE.MathUtils.clamp(params.planetRoughness * 0.65, 0.05, 0.95);

    const uniforms = {
      uDayColor: { value: new THREE.Color('#3a4b66') }, // Brighter day blue
      uNightColor: { value: new THREE.Color('#0c0e15') },
      uTerminatorColor: { value: new THREE.Color('#ff5522') },
      uRimColor: { value: new THREE.Color(params.atmosphereColor) },
      uLightDir: { value: lightDir },
      uRimPower: { value: params.rimPower },
      uRimIntensity: { value: params.rimIntensity },
      uTerminatorSharpness: { value: params.terminatorSharpness },
      uTerminatorBoost: { value: params.terminatorBoost },
      uAmbientFloor: { value: ambientFloor },
      uGridSize: { value: new THREE.Vector2(params.lonCells, params.latCells) },
      uRoughnessBase: { value: params.planetRoughness },
      uEcologyIntensity: { value: params.ecologyIntensity },
      uSunColor: { value: new THREE.Color('#fff0d0') }, // Warm sun specular
      uNoiseMap: { value: params.noiseTexture },
    } satisfies Record<
      string,
      { value: THREE.Vector3 | THREE.Color | number | THREE.Vector2 | THREE.Texture }
    >;

    const material = new THREE.ShaderMaterial({
      uniforms,
      wireframe: params.planetWireframe,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vWorldPos;
        varying vec2 vUv;

        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vUv = uv;
          
          vNormal = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uDayColor;
        uniform vec3 uNightColor;
        uniform vec3 uTerminatorColor;
        uniform vec3 uRimColor;
        uniform vec3 uSunColor;
        uniform vec3 uLightDir;
        uniform float uRimPower;
        uniform float uRimIntensity;
        uniform float uTerminatorSharpness;
        uniform float uTerminatorBoost;
        uniform float uAmbientFloor;
        uniform vec2 uGridSize;
        uniform float uRoughnessBase;
        uniform float uEcologyIntensity;
        uniform sampler2D uNoiseMap;

        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vWorldPos;
        varying vec2 vUv;

        ${PLANET_NOISE_EQUIRECT_GLSL}

        void main() {
          vec3 n = normalize(vNormal);
          vec3 l = normalize(uLightDir);
          vec3 v = normalize(vViewDir);

          // 1. Noise
          // Static noise baked once by usePlanetNoiseTexture (see planetNoiseBake.ts).
          vec4 noise = texture2D(uNoiseMap, planetNoiseUv(normalize(vWorldPos)));
          float noiseHigh = noise.r * 2.0 - 1.0;
          float noiseLow = noise.g * 2.0 - 1.0;
          float basinNoise = noise.b;
          float ridgeNoise = noise.a;
          vec3 bumpParams = vec3(noiseHigh * 0.05); 
          n = normalize(n + bumpParams * 0.2);

          // 2. Grid Anchor
          vec2 gridUV = vUv * uGridSize;
          vec2 gridPos = fract(gridUV);
          vec2 distToEdge = min(gridPos, 1.0 - gridPos);
          float minDist = min(distToEdge.x, distToEdge.y);
          float gridEdge = smoothstep(0.02, 0.08, minDist);
          float seamAO = mix(0.7, 1.0, gridEdge);

          // 3. Lighting
          float ndl = max(0.0, dot(n, l));
          
          // Specular (Phong)
          vec3 r = reflect(-l, n);
          float specFactor = pow(max(0.0, dot(r, v)), 20.0); // Shininess for ocean
          // Mask specular by grid edge (cells are matte?) or just let it be
          // Let's add specular
          vec3 specular = uSunColor * specFactor * 0.4; // 40% intensity

          // Terminator
          float lightFactor = smoothstep(-0.2, 0.2, dot(n, l)); // Use unmasked dot for terminator
          float terminatorBand = 1.0 - abs(dot(n, l));
          terminatorBand = pow(terminatorBand, uTerminatorSharpness);
          
          float shade = max(lightFactor, uAmbientFloor * 0.1); 
          
          vec3 dayColor = uDayColor + vec3(noiseLow * 0.02);
          vec3 nightColor = uNightColor - vec3(noiseLow * 0.01);
          float equator = 1.0 - abs(n.y);
          float temperature = clamp(equator * 0.78 + basinNoise * 0.22, 0.0, 1.0);
          float moisture = clamp(basinNoise * 0.62 + equator * 0.24 - max(0.0, ridgeNoise - 0.62) * 0.35, 0.0, 1.0);
          vec3 desertColor = vec3(0.54, 0.34, 0.21);
          vec3 wetlandColor = vec3(0.08, 0.29, 0.24);
          vec3 highlandColor = vec3(0.33, 0.34, 0.36);
          vec3 iceColor = vec3(0.62, 0.78, 0.86);
          vec3 coastColor = vec3(0.20, 0.43, 0.39);
          vec3 biomeColor = mix(iceColor, coastColor, temperature);
          biomeColor = mix(biomeColor, wetlandColor, smoothstep(0.66, 0.92, moisture));
          biomeColor = mix(biomeColor, desertColor, smoothstep(0.34, 0.12, moisture));
          biomeColor = mix(biomeColor, highlandColor, smoothstep(0.68, 0.9, ridgeNoise));
          dayColor = mix(dayColor, biomeColor, uEcologyIntensity);
          
          vec3 surfaceColor = mix(nightColor, dayColor, shade);
          vec3 sunset = uTerminatorColor * terminatorBand * (0.4 + uTerminatorBoost);
          
          /* Combine */
          surfaceColor += sunset;
          surfaceColor *= seamAO;
          
          // Add specular only on lit side
          surfaceColor += specular * shade; 

          // Rim
          float rimMatch = 1.0 - max(0.0, dot(n, v));
          float rim = pow(rimMatch, uRimPower);
          float atmosphere = pow(rimMatch, uRimPower * 0.6) * 0.5;
          vec3 finalRim = uRimColor * (rim * uRimIntensity + atmosphere * uRimIntensity * 0.5);
          
          vec3 finalColor = surfaceColor + finalRim;
          
          gl_FragColor = vec4(finalColor, 1.0);
          ${DISPLAY_REFERRED_OUTPUT}
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
    params.ecologyIntensity,
    params.latCells,
    params.lonCells,
    params.lightPosition,
    params.noiseTexture,
  ]);

  // Dispose logic remains the same (handled by react usually but explicit dispose is good)
  useEffect(() => {
    return () => planetMaterial.dispose();
  }, [planetMaterial]);

  return planetMaterial;
}
