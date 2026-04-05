import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import type { Texture } from 'three';
import * as THREE from 'three';

import { gpuOverlayFragmentShader } from '../../shaders/gpuOverlay.frag';
import { gpuOverlayVertexShader } from '../../shaders/gpuOverlay.vert';
import { AGE_FADE_BASE, AGE_FADE_MAX, AGE_FADE_MIN, AGE_FADE_SCALE } from '../../sim/utils';

export interface LifeOverlayProps {
  planetRadius: number;
  cellLift: number;
  pulseSpeed: number;
  pulseIntensity: number;
  cellOverlayOpacity: number;
  lifeTexture: Texture | null;
  gpuOverlayMaterial: THREE.ShaderMaterial;
  debugLogs: boolean;
}

export function LifeOverlay({
  planetRadius,
  cellLift,
  pulseSpeed,
  pulseIntensity,
  cellOverlayOpacity,
  lifeTexture,
  gpuOverlayMaterial,
  debugLogs,
}: LifeOverlayProps) {
  useEffect(() => {
    if (gpuOverlayMaterial) {
      const tex = lifeTexture;
      if (tex) {
        // eslint-disable-next-line react-hooks/immutability
        gpuOverlayMaterial.uniforms.uLifeTexture.value = tex;
        // eslint-disable-next-line react-hooks/immutability
        tex.needsUpdate = true;
      }

      gpuOverlayMaterial.uniforms.uDebugOverlay.value = false;
      gpuOverlayMaterial.uniforms.uDebugMode.value = debugLogs ? 4 : 0;
      gpuOverlayMaterial.uniforms.uDebugScale.value = debugLogs ? 4.0 : 1.0;
    }
  }, [lifeTexture, gpuOverlayMaterial, debugLogs]);

  useFrame((state) => {
    if (gpuOverlayMaterial) {
      // eslint-disable-next-line react-hooks/immutability
      gpuOverlayMaterial.uniforms.uTime.value = state.clock.elapsedTime;
      gpuOverlayMaterial.uniforms.uCellLift.value = cellLift;
      gpuOverlayMaterial.uniforms.uPulseSpeed.value = pulseSpeed;
      gpuOverlayMaterial.uniforms.uPulseIntensity.value = pulseIntensity;
      gpuOverlayMaterial.uniforms.uCellOverlayOpacity.value = cellOverlayOpacity;
    }
  });

  return (
    <mesh scale={1.01} raycast={() => null}>
      <sphereGeometry args={[planetRadius, 64, 64]} />
      <primitive object={gpuOverlayMaterial} attach="material" />
    </mesh>
  );
}

export function createGpuOverlayMaterial(params: {
  cellColor: string;
  cellColorMode: 'Solid' | 'Age Fade' | 'Neighbor Heat';
  colonyColorA: string;
  colonyColorB: string;
  heatLowColor: string;
  heatMidColor: string;
  heatHighColor: string;
  ageFadeHalfLife: number;
  cellOverlayOpacity: number;
  gameMode: 'Classic' | 'Colony';
}): THREE.ShaderMaterial {
  const colorModeValue =
    params.cellColorMode === 'Solid' ? 0 : params.cellColorMode === 'Age Fade' ? 1 : 2;

  return new THREE.ShaderMaterial({
    uniforms: {
      uLifeTexture: { value: null },
      uCellLift: { value: 0 },
      uPulseSpeed: { value: 0 },
      uPulseIntensity: { value: 0 },
      uTime: { value: 0 },
      uCellColor: { value: new THREE.Color(params.cellColor) },
      uColonyColorA: { value: new THREE.Color(params.colonyColorA) },
      uColonyColorB: { value: new THREE.Color(params.colonyColorB) },
      uHeatLowColor: { value: new THREE.Color(params.heatLowColor) },
      uHeatMidColor: { value: new THREE.Color(params.heatMidColor) },
      uHeatHighColor: { value: new THREE.Color(params.heatHighColor) },
      uAgeFadeHalfLife: { value: Math.max(1, params.ageFadeHalfLife) },
      uAgeFadeBase: { value: AGE_FADE_BASE },
      uAgeFadeScale: { value: AGE_FADE_SCALE },
      uAgeFadeMin: { value: AGE_FADE_MIN },
      uAgeFadeMax: { value: AGE_FADE_MAX },
      uColorMode: { value: colorModeValue },
      uCellOverlayOpacity: { value: params.cellOverlayOpacity },
      uColonyMode: { value: params.gameMode === 'Colony' },
      uDebugOverlay: { value: false },
      uDebugColor: { value: new THREE.Color('#ff00ff') },
      uDebugMode: { value: 0 },
      uDebugScale: { value: 1 },
    },
    vertexShader: gpuOverlayVertexShader,
    fragmentShader: gpuOverlayFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
}
