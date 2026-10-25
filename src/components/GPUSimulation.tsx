import { useFrame, useThree } from '@react-three/fiber';
import { useImperativeHandle, useRef } from 'react';
import type * as THREE from 'three';

import type { EcologyProfileName } from '../sim/ecology';
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
}

export const GPUSimulation = ({
  resolution = { width: 512, height: 512 },
  running = true,
  tickMs = 120,
  rules,
  randomDensity = 0.1,
  gameMode = 'Classic',
  ecologyProfile = 'None',
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

  const pingPong = useGpuPingPong(resolution);
  const { simMaterial, simScene, seedMaterial, seedScene, statsMaterial, statsScene } =
    useGpuSimMaterials({ resolution, rules, gameMode, ecologyProfile });
  const { readStats } = useGpuStatsReadback({
    gl,
    resolution,
    onStats,
    statsMaterial,
    statsScene,
    generationRef,
  });
  // Declared after the stats hook on purpose: its init effect issues a forced
  // readback and needs the stats epoch to already describe the new targets.
  const { initializeState, seedAtUV } = useGpuSeeder({
    gl,
    resolution,
    randomDensity,
    gameMode,
    pingPong,
    simMaterial,
    simScene,
    seedMaterial,
    seedScene,
    generationRef,
    readStats,
    onTextureUpdate,
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
    gl.render(simScene.scene, simScene.camera);
    gl.setRenderTarget(prevTarget);

    pingPong.swap();
    generationRef.current += 1;
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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `advance` is recreated each render; its inputs are covered by these deps.
    [
      initializeState,
      randomDensity,
      readStats,
      seedAtUV,
      pingPong,
      gl,
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
