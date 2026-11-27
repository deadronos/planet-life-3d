import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type * as THREE from 'three';

import { advanceSolarPhase, type EcologyProfileName, SOIL_NEUTRAL } from '../sim/ecology';
import type { Rules } from '../sim/rules';
import { useGpuPingPong } from './gpuSimulation/useGpuPingPong';
import { type SeedAtUVParams, useGpuSeeder } from './gpuSimulation/useGpuSeeder';
import { useGpuSimMaterials } from './gpuSimulation/useGpuSimMaterials';
import { type GpuStats, useGpuStatsReadback } from './gpuSimulation/useGpuStatsReadback';

export interface GPUSimulationHandle {
  seedAtUV: (params: SeedAtUVParams) => void;
  randomize: () => void;
  clear: () => void;
  stepOnce: () => void;
  getSolarPhase?: () => number;
  sampleSoilAtCell?: (lat: number, lon: number) => number;
}

export const GPUSimulation = ({
  resolution = { width: 512, height: 512 },
  running = true,
  tickMs = 120,
  rules,
  randomDensity = 0.1,
  gameMode = 'Classic',
  ecologyProfile = 'None',
  polarWrap = false,
  colonyBiomeAffinity = false,
  solarCycleSpeed = 0,
  dynamicFertility = false,
  onTextureUpdate,
  onStats,
  simRef,
}: {
  resolution?: { width: number; height: number };
  running?: boolean;
  tickMs?: number;
  rules: Rules;
  randomDensity?: number;
  gameMode?: 'Classic' | 'Colony';
  ecologyProfile?: EcologyProfileName;
  polarWrap?: boolean;
  colonyBiomeAffinity?: boolean;
  solarCycleSpeed?: number;
  dynamicFertility?: boolean;
  onTextureUpdate?: (texture: THREE.Texture) => void;
  onStats?: (stats: GpuStats) => void;
  simRef?: React.Ref<GPUSimulationHandle>;
}) => {
  const { gl } = useThree();

  // Track last tick time for throttling
  const lastTickTimeRef = useRef<number>(0);

  // Generation counter for the HUD. Reset whenever the world is
  // re-initialized (randomize / clear).
  const generationRef = useRef(0);
  const solarPhaseRef = useRef(0);
  const solarCycleSpeedRef = useRef(solarCycleSpeed);
  const dynamicFertilityRef = useRef(dynamicFertility);
  useEffect(() => {
    solarCycleSpeedRef.current = solarCycleSpeed;
  }, [solarCycleSpeed]);
  useEffect(() => {
    dynamicFertilityRef.current = dynamicFertility;
  }, [dynamicFertility]);

  const pingPong = useGpuPingPong(resolution);
  const {
    simMaterial,
    simScene,
    seedMaterial,
    seedScene,
    copyMaterial,
    copyScene,
    statsMaterial,
    statsScene,
  } = useGpuSimMaterials({
    resolution,
    rules,
    gameMode,
    ecologyProfile,
    polarWrap,
    colonyBiomeAffinity,
    dynamicFertility,
  });
  const { readStats } = useGpuStatsReadback({
    gl,
    resolution,
    onStats,
    statsMaterial,
    statsScene,
    generationRef,
  });
  const onResetState = useCallback(() => {
    solarPhaseRef.current = 0;
  }, []);
  // Declared after the stats hook on purpose: its init effect issues a forced
  // readback and needs the stats epoch to already describe the new targets.
  const { initializeState, seedAtUV } = useGpuSeeder({
    gl,
    resolution,
    randomDensity,
    gameMode,
    pingPong,
    copyMaterial,
    copyScene,
    seedMaterial,
    seedScene,
    generationRef,
    readStats,
    onTextureUpdate,
    onResetState,
  });

  /** Run one simulation step: read buffer -> write buffer, then swap. */
  const advance = (forceStats: boolean) => {
    const { read, write } = pingPong.getBuffers();
    const readTexture = read.texture;
    const writeTexture = write.texture;
    const prevTarget = gl.getRenderTarget();
    gl.setRenderTarget(write);
    // eslint-disable-next-line react-hooks/immutability -- Mutating three.js uniforms in the render loop / imperative handle is the point; the values are GPU handles, not React state.
    simMaterial.uniforms.uTexture.value = readTexture;
    simMaterial.uniforms.uGeneration.value = generationRef.current;
    simMaterial.uniforms.uSolarPhase.value = solarPhaseRef.current;
    gl.render(simScene.scene, simScene.camera);
    gl.setRenderTarget(prevTarget);

    pingPong.swap();
    generationRef.current += 1;
    solarPhaseRef.current = advanceSolarPhase(solarPhaseRef.current, solarCycleSpeedRef.current);
    readStats(writeTexture, readTexture, forceStats);

    // Notify parent of texture update
    if (onTextureUpdate) {
      onTextureUpdate(writeTexture);
    }
  };

  // Expose seeding method via ref
  useImperativeHandle(
    simRef,
    () => ({
      seedAtUV,
      randomize: () => {
        initializeState(randomDensity);
      },
      clear: () => {
        initializeState(0);
      },
      // Explicit single-step from the UI: report the new generation now.
      stepOnce: () => advance(true),
      getSolarPhase: () => solarPhaseRef.current,
      sampleSoilAtCell: (lat: number, lon: number) => {
        if (!dynamicFertilityRef.current) return SOIL_NEUTRAL;
        const { read } = pingPong.getBuffers();
        const x = Math.max(0, Math.min(resolution.width - 1, Math.floor(lon)));
        const y = Math.max(0, Math.min(resolution.height - 1, Math.floor(lat)));
        const pixel = new Uint8Array([0, 0, 0, SOIL_NEUTRAL]);
        try {
          gl.readRenderTargetPixels(read, x, y, 1, 1, pixel);
        } catch {
          return SOIL_NEUTRAL;
        }
        return pixel[3];
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `advance` is recreated each render; its inputs are covered by these deps.
    [
      initializeState,
      randomDensity,
      readStats,
      seedAtUV,
      pingPong,
      gl,
      resolution.width,
      resolution.height,
      onTextureUpdate,
      simMaterial,
      simScene,
    ],
  );

  // Simulation update loop with tick speed throttling
  // eslint-disable-next-line react-hooks/immutability -- The render loop mutates material uniforms per tick by design; these are GPU handles rather than React state.
  useFrame(() => {
    if (!running) return;

    // Throttle updates based on tickMs
    const now = performance.now();
    const elapsed = now - lastTickTimeRef.current;
    if (tickMs <= 0 || elapsed < tickMs) return;

    lastTickTimeRef.current = now;
    advance(false);
  });

  return null; // This component doesn't render anything visible
};
