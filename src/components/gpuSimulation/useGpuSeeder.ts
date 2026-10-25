import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { createSeededRng } from '../../sim/seededRng';
import { useUIStore } from '../../store/useUIStore';
import { PatternTextureCache } from '../patternTextureCache';
import type { FullscreenPass, Resolution } from './common';
import type { GpuPingPong } from './useGpuPingPong';

export interface SeedAtUVParams {
  u: number;
  v: number;
  pattern: number[][];
  mode: 'set' | 'toggle' | 'clear' | 'random';
  probability?: number;
  originRow: number;
  originCol: number;
}

export interface GpuSeeder {
  /** Fill both buffers with random state at `density` and reset the generation. */
  initializeState: (density: number, seed?: number) => void;
  seedAtUV: (params: SeedAtUVParams) => void;
}

const SEED_MODE = { set: 0, toggle: 1, clear: 2, random: 3 } as const;

/**
 * Seeding passes: whole-world (re)initialisation used by randomize / clear /
 * resolution change, and pattern stamping (`seedAtUV`) used by meteors.
 *
 * Also runs the initialisation effect: it fires on mount and whenever
 * `initializeState` changes identity (i.e. the resolution / targets changed),
 * and must NOT fire on rules / gameMode / density changes.
 */
export function useGpuSeeder({
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
}: {
  gl: THREE.WebGLRenderer;
  resolution: Resolution;
  randomDensity: number;
  gameMode: 'Classic' | 'Colony';
  pingPong: GpuPingPong;
  simMaterial: THREE.ShaderMaterial;
  simScene: FullscreenPass;
  seedMaterial: THREE.ShaderMaterial;
  seedScene: FullscreenPass;
  generationRef: React.MutableRefObject<number>;
  readStats: (current: THREE.Texture, prev: THREE.Texture, force?: boolean) => void;
  onTextureUpdate?: (texture: THREE.Texture) => void;
}): GpuSeeder {
  const { targetA, targetB, currentBufferRef, getBuffers, swap } = pingPong;

  // Cache for pattern DataTextures used by seedAtUV. Created lazily and
  // disposed on unmount so we don't leak GPU memory across remounts.
  const patternCacheRef = useRef<PatternTextureCache | null>(null);
  useEffect(() => {
    return () => {
      patternCacheRef.current?.dispose();
      patternCacheRef.current = null;
    };
  }, []);

  // Refs that mirror the latest Leva values for use inside the stable
  // initializeState closure. Reading from refs keeps initializeState's
  // identity stable across gameMode / randomDensity changes, which is
  // critical: otherwise re-creating initializeState would re-run the init
  // effect and wipe the entire simulation whenever the user typed in
  // birthDigits or toggled gameMode.
  const gameModeRef = useRef(gameMode);
  const randomDensityRef = useRef(randomDensity);
  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);
  useEffect(() => {
    randomDensityRef.current = randomDensity;
  }, [randomDensity]);

  // eslint-disable-next-line react-hooks/immutability -- initializeState is an imperative closure that writes material uniforms; these are GPU handles, not React state.
  const initializeState = useMemo(() => {
    return (density: number, seed: number = useUIStore.getState().worldSeed) => {
      // Same generator and draw order as LifeGridSimBase.randomize, so a seed gives
      // the identical pattern as the CPU/worker path (texel i == cell i).
      const rng = createSeededRng(seed);
      const size = resolution.width * resolution.height * 4;
      const data = new Float32Array(size);
      // Read the *current* game mode from a ref so this closure can be
      // identity-stable. The caller passes the density explicitly.
      const useColony = gameModeRef.current === 'Colony';
      const useDensity = density;
      for (let i = 0; i < size; i += 4) {
        let state = 0.0;
        if (rng() < useDensity) {
          if (useColony) {
            // Colony mode: 0.33 for Colony A, 0.67 for Colony B
            state = rng() < 0.5 ? 0.33 : 0.67;
          } else {
            // Classic mode: 1.0 for alive
            state = 1.0;
          }
        }
        data[i] = state; // R: alive/dead or colony state
        data[i + 1] = 0.0; // G: age (starts at 0)
        data[i + 2] = 0.0; // B: neighbor heat (starts at 0)
        data[i + 3] = 1.0; // A: always 1
      }

      const texture = new THREE.DataTexture(
        data,
        resolution.width,
        resolution.height,
        THREE.RGBAFormat,
        THREE.FloatType,
      );
      texture.needsUpdate = true;

      const prevTarget = gl.getRenderTarget();

      gl.setRenderTarget(targetA);
      gl.clear();
      // eslint-disable-next-line react-hooks/immutability -- Seeds the material inside the imperative initializeState closure; uniforms are GPU handles, not React state.
      simMaterial.uniforms.uTexture.value = texture;
      gl.render(simScene.scene, simScene.camera);

      gl.setRenderTarget(targetB);
      gl.clear();
      gl.render(simScene.scene, simScene.camera);

      gl.setRenderTarget(prevTarget);

      texture.dispose();

      currentBufferRef.current = 'A';
      generationRef.current = 0;
      if (onTextureUpdate) {
        onTextureUpdate(targetA.texture);
      }
      // Discrete user action (randomize / clear / resolution change): refresh
      // the HUD immediately rather than waiting for the next sampled tick.
      readStats(targetA.texture, targetA.texture, true);
    };
    // Intentionally not depending on `gameMode`, `randomDensity`, or
    // `simMaterial`/`seedMaterial`: those are read from refs / already
    // stable. If we listed them, toggling Colony mode or typing in
    // birthDigits would re-create this closure and re-fire the init effect
    // below, wiping the simulation.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load-bearing: gameMode/randomDensity are read through refs; listing them here would re-fire the init effect and wipe the simulation.
  }, [
    gl,
    onTextureUpdate,
    readStats,
    resolution.height,
    resolution.width,
    simScene,
    targetA,
    targetB,
  ]);

  // Initialize the render targets with the initial random state. This must
  // run when the resolution changes (new render targets are allocated) and
  // must NOT run on every Leva knob change, otherwise typing in
  // birthDigits/surviveDigits or toggling gameMode would wipe the simulation.
  useEffect(() => {
    initializeState(randomDensity);
    // Random density is intentionally NOT in the dep list so adjusting the
    // slider does not auto-reset the world - users reset via the "Randomize"
    // action button.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load-bearing: randomDensity is intentionally excluded so moving the slider does not reset the world.
  }, [initializeState]);

  const seedAtUV = useCallback(
    // eslint-disable-next-line react-hooks/immutability -- Seeding writes shader uniforms imperatively; these are GPU handles, not React state.
    ({ u, v, pattern, mode, probability = 0.5, originRow, originCol }: SeedAtUVParams) => {
      // Reuse a cached DataTexture for this pattern when possible. Building
      // and uploading a fresh texture on every impact wasted GC and GPU upload
      // time, especially with the meteor shower enabled.
      const patternHeight = pattern.length;
      const patternWidth = patternHeight > 0 ? pattern[0].length : 0;
      if (patternWidth === 0 || patternHeight === 0) return;
      if (patternCacheRef.current === null) {
        patternCacheRef.current = new PatternTextureCache();
      }
      const patternTexture = patternCacheRef.current.getOrCreate(pattern);

      // Set seeding uniforms
      // eslint-disable-next-line react-hooks/immutability -- Seeding writes shader uniforms imperatively; these are GPU handles, not React state.
      seedMaterial.uniforms.uPatternData.value = patternTexture;
      const seedCenter = seedMaterial.uniforms.uSeedCenter.value as THREE.Vector2;
      seedCenter.set(u, v);
      const patternSize = seedMaterial.uniforms.uPatternSize.value as THREE.Vector2;
      patternSize.set(patternWidth, patternHeight);
      const patternOrigin = seedMaterial.uniforms.uPatternOrigin.value as THREE.Vector2;
      patternOrigin.set(originCol, originRow);
      seedMaterial.uniforms.uSeedMode.value = SEED_MODE[mode];
      seedMaterial.uniforms.uSeedProbability.value = probability;
      seedMaterial.uniforms.uRandomSeed.value = Math.random();
      seedMaterial.uniforms.uColonyMode.value = gameMode === 'Colony';

      // Render seeding pass into the *opposite* buffer to avoid feedback loops
      // (sample from the current buffer's texture, write into the other one).
      const prevTarget = gl.getRenderTarget();
      const { read, write } = getBuffers();
      const readTexture = read.texture;
      const writeTexture = write.texture;
      gl.setRenderTarget(write);
      // Ensure the shader sees the current state texture
      seedMaterial.uniforms.uCurrentState.value = readTexture;
      gl.render(seedScene.scene, seedScene.camera);
      gl.setRenderTarget(prevTarget);

      // Swap buffers: the newly written buffer becomes the current/read buffer
      swap();

      // Seeding changes population immediately, but meteor showers can fire
      // many impacts per tick - let the throttle decide rather than forcing
      // a readback per impact.
      readStats(writeTexture, readTexture);

      // Notify parent of update
      if (onTextureUpdate) {
        onTextureUpdate(writeTexture);
      }
    },
    [gl, gameMode, getBuffers, onTextureUpdate, readStats, seedMaterial, seedScene, swap],
  );

  return { initializeState, seedAtUV };
}
