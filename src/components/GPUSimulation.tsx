/* eslint-disable react-hooks/immutability */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { gpuSeedFragmentShader } from '../shaders/gpuSeed.frag';
import { simulationFragmentShader } from '../shaders/simulation.frag';
import { simulationVertexShader } from '../shaders/simulation.vert';
import type { Rules } from '../sim/rules';
import { PatternTextureCache } from './patternTextureCache';

// Helper to create FBO (Frame Buffer Object / Render Target)
function createRenderTarget(width: number, height: number): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    // Use UnsignedByte texture target so the produced texture can be sampled
    // and displayed reliably across more WebGL contexts; 8-bit precision is
    // sufficient for visualization (age/heat/colors are quantized in shaders).
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    stencilBuffer: false,
    depthBuffer: false,
  });
}

// Convert boolean rules array to float array for shader
function rulesToFloatArray(rules: boolean[]): number[] {
  return rules.map((r) => (r ? 1.0 : 0.0));
}

export interface GPUSimulationHandle {
  seedAtUV: (params: {
    u: number;
    v: number;
    pattern: number[][];
    mode: 'set' | 'toggle' | 'clear' | 'random';
    probability?: number;
    originRow: number;
    originCol: number;
  }) => void;
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
  onTextureUpdate,
  simRef,
}: {
  resolution?: { width: number; height: number };
  running?: boolean;
  tickMs?: number;
  rules: Rules;
  randomDensity?: number;
  gameMode?: 'Classic' | 'Colony';
  onTextureUpdate?: (texture: THREE.Texture) => void;
  simRef?: React.Ref<GPUSimulationHandle>;
}) => {
  const { gl } = useThree();

  // Ping-pong render targets for double buffering
  const targetA = useMemo(
    () => createRenderTarget(resolution.width, resolution.height),
    [resolution.height, resolution.width],
  );
  const targetB = useMemo(
    () => createRenderTarget(resolution.width, resolution.height),
    [resolution.height, resolution.width],
  );

  // Track which buffer is the current "read" buffer
  const currentBufferRef = useRef<'A' | 'B'>('A');

  // Track last tick time for throttling
  const lastTickTimeRef = useRef<number>(0);

  // Cache for pattern DataTextures used by seedAtUV. Created once and
  // disposed on unmount so we don't leak GPU memory across remounts.
  const patternCacheRef = useRef<PatternTextureCache | null>(null);
  if (patternCacheRef.current === null) {
    patternCacheRef.current = new PatternTextureCache();
  }

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

  // Create the simulation material exactly once. We mutate its uniforms in
  // place from a separate effect when rules/gameMode change, so the
  // material's identity stays stable. (Previously this useMemo depended on
  // `rules` and `gameMode`, so editing birth/survive digits recreated the
  // material and wiped the simulation.)
  const simMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: null },
        uResolution: { value: new THREE.Vector2(resolution.width, resolution.height) },
        uBirthRules: { value: rulesToFloatArray(rules.birth) },
        uSurviveRules: { value: rulesToFloatArray(rules.survive) },
        uColonyMode: { value: gameMode === 'Colony' },
      },
      vertexShader: simulationVertexShader,
      fragmentShader: simulationFragmentShader,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution.height, resolution.width]);

  // Separate scene for simulation rendering (doesn't show in main view)
  const simScene = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial);
    scene.add(quad);
    return { scene, camera, quad };
  }, [simMaterial]);

  // Seeding material for writing patterns to texture. Created once and
  // updated in place when gameMode changes (same reason as simMaterial).
  const seedMaterial = useMemo(() => {
    const modeMap = { set: 0, toggle: 1, clear: 2, random: 3 };
    return new THREE.ShaderMaterial({
      uniforms: {
        uCurrentState: { value: null },
        uPatternData: { value: null },
        uResolution: { value: new THREE.Vector2(resolution.width, resolution.height) },
        uSeedCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uPatternSize: { value: new THREE.Vector2(1, 1) },
        uPatternOrigin: { value: new THREE.Vector2(0, 0) },
        uSeedMode: { value: modeMap.set },
        uSeedProbability: { value: 0.5 },
        uColonyMode: { value: gameMode === 'Colony' },
        uRandomSeed: { value: 0 },
      },
      vertexShader: simulationVertexShader,
      fragmentShader: gpuSeedFragmentShader,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution.height, resolution.width]);

  const seedScene = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), seedMaterial);
    scene.add(quad);
    return { scene, camera, quad };
  }, [seedMaterial]);

  const initializeState = useMemo(() => {
    return (density: number) => {
      const size = resolution.width * resolution.height * 4;
      const data = new Float32Array(size);
      // Read the *current* game mode and density from refs so this closure
      // can be identity-stable. The caller may pass a density override (e.g.
      // explicit "Randomize" action) but defaults to the latest Leva value.
      const useColony = gameModeRef.current === 'Colony';
      const useDensity = density;
      for (let i = 0; i < size; i += 4) {
        let state = 0.0;
        if (Math.random() < useDensity) {
          if (useColony) {
            // Colony mode: 0.33 for Colony A, 0.67 for Colony B
            state = Math.random() < 0.5 ? 0.33 : 0.67;
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
      simMaterial.uniforms.uTexture.value = texture;
      gl.render(simScene.scene, simScene.camera);

      gl.setRenderTarget(targetB);
      gl.clear();
      gl.render(simScene.scene, simScene.camera);

      gl.setRenderTarget(prevTarget);

      texture.dispose();

      currentBufferRef.current = 'A';
      if (onTextureUpdate) {
        onTextureUpdate(targetA.texture);
      }
    };
    // Intentionally not depending on `gameMode`, `randomDensity`, or
    // `simMaterial`/`seedMaterial`: those are read from refs / already
    // stable. If we listed them, toggling Colony mode or typing in
    // birthDigits would re-create this closure and re-fire the init effect
    // below, wiping the simulation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, onTextureUpdate, resolution.height, resolution.width, simScene, targetA, targetB]);

  // Initialize the render targets with the initial random state. This must
  // run when the resolution changes (new render targets are allocated) and
  // must NOT run on every Leva knob change, otherwise typing in
  // birthDigits/surviveDigits or toggling gameMode would wipe the simulation.
  useEffect(() => {
    initializeState(randomDensity);
    // initializeState captures randomDensity, resolution, and the render
    // targets via closure. We only re-initialize when the resolution
    // changes (which re-creates targetA/targetB). Random density is
    // intentionally NOT in the dep list so adjusting the slider does not
    // auto-reset the world — users reset via the "Randomize" action button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializeState]);

  // Update rules and game mode when they change
  useEffect(() => {
    const birthRules = rulesToFloatArray(rules.birth);
    const surviveRules = rulesToFloatArray(rules.survive);
    simMaterial.uniforms.uBirthRules.value = birthRules;
    simMaterial.uniforms.uSurviveRules.value = surviveRules;
    simMaterial.uniforms.uColonyMode.value = gameMode === 'Colony';
  }, [rules, gameMode, simMaterial]);

  // Expose seeding method via ref
  useImperativeHandle(
    simRef,
    () => ({
      seedAtUV: ({ u, v, pattern, mode, probability = 0.5, originRow, originCol }) => {
        // Reuse a cached DataTexture for this pattern when possible. Building
        // and uploading a fresh texture on every impact (the previous
        // behavior) wasted GC and GPU upload time, especially with the
        // meteor shower enabled.
        const patternHeight = pattern.length;
        const patternWidth = patternHeight > 0 ? pattern[0].length : 0;
        if (patternWidth === 0 || patternHeight === 0) return;
        const patternTexture = patternCacheRef.current!.getOrCreate(pattern);

        // Set seeding uniforms
        const modeMap = { set: 0, toggle: 1, clear: 2, random: 3 };
        seedMaterial.uniforms.uCurrentState.value =
          currentBufferRef.current === 'A' ? targetA.texture : targetB.texture;
        seedMaterial.uniforms.uPatternData.value = patternTexture;
        const seedCenter = seedMaterial.uniforms.uSeedCenter.value as THREE.Vector2;
        seedCenter.set(u, v);
        const patternSize = seedMaterial.uniforms.uPatternSize.value as THREE.Vector2;
        patternSize.set(patternWidth, patternHeight);
        const patternOrigin = seedMaterial.uniforms.uPatternOrigin.value as THREE.Vector2;
        patternOrigin.set(originCol, originRow);
        seedMaterial.uniforms.uSeedMode.value = modeMap[mode];
        seedMaterial.uniforms.uSeedProbability.value = probability;
        seedMaterial.uniforms.uRandomSeed.value = Math.random();
        seedMaterial.uniforms.uColonyMode.value = gameMode === 'Colony';

        // Render seeding pass into the *opposite* buffer to avoid feedback loops
        // (sample from currentBuffer.texture, write into writeBuffer)
        const prevTarget = gl.getRenderTarget();
        const readBuffer = currentBufferRef.current === 'A' ? targetA : targetB;
        const writeBuffer = currentBufferRef.current === 'A' ? targetB : targetA;
        gl.setRenderTarget(writeBuffer);
        // Ensure the shader sees the current state texture
        seedMaterial.uniforms.uCurrentState.value = readBuffer.texture;
        gl.render(seedScene.scene, seedScene.camera);
        gl.setRenderTarget(prevTarget);

        // Swap buffers: the newly written buffer becomes the current/read buffer
        currentBufferRef.current = currentBufferRef.current === 'A' ? 'B' : 'A';

        // Notify parent of update
        if (onTextureUpdate) {
          onTextureUpdate(writeBuffer.texture);
        }
      },
      randomize: () => {
        initializeState(randomDensity);
      },
      clear: () => {
        initializeState(0);
      },
      stepOnce: () => {
        const readBuffer = currentBufferRef.current === 'A' ? targetA : targetB;
        const writeBuffer = currentBufferRef.current === 'A' ? targetB : targetA;
        const prevTarget = gl.getRenderTarget();
        gl.setRenderTarget(writeBuffer);
        simMaterial.uniforms.uTexture.value = readBuffer.texture;
        gl.render(simScene.scene, simScene.camera);
        gl.setRenderTarget(prevTarget);
        currentBufferRef.current = currentBufferRef.current === 'A' ? 'B' : 'A';
        if (onTextureUpdate) {
          onTextureUpdate(writeBuffer.texture);
        }
      },
    }),
    [
      initializeState,
      randomDensity,
      seedMaterial,
      seedScene,
      targetA,
      targetB,
      currentBufferRef,
      gl,
      gameMode,
      onTextureUpdate,
      simMaterial,
      simScene,
    ],
  );

  // Simulation update loop with tick speed throttling
  useFrame(() => {
    if (!running) return;

    // Throttle updates based on tickMs
    const now = performance.now();
    const elapsed = now - lastTickTimeRef.current;
    if (tickMs <= 0 || elapsed < tickMs) return;

    lastTickTimeRef.current = now;

    // Determine read and write buffers
    const readBuffer = currentBufferRef.current === 'A' ? targetA : targetB;
    const writeBuffer = currentBufferRef.current === 'A' ? targetB : targetA;

    // Render simulation step to write buffer
    // Modifying uniforms in useFrame is allowed - it's a render loop, not React render
    const prevTarget = gl.getRenderTarget();
    gl.setRenderTarget(writeBuffer);
    simMaterial.uniforms.uTexture.value = readBuffer.texture;
    gl.render(simScene.scene, simScene.camera);
    gl.setRenderTarget(prevTarget);

    // Swap buffers
    currentBufferRef.current = currentBufferRef.current === 'A' ? 'B' : 'A';

    // Notify parent of texture update
    if (onTextureUpdate) {
      onTextureUpdate(writeBuffer.texture);
    }
  });

  // Cleanup
  useEffect(() => {
    return () => {
      targetA.dispose();
      targetB.dispose();
      simMaterial.dispose();
      seedMaterial.dispose();
      simScene.quad.geometry.dispose();
      seedScene.quad.geometry.dispose();
      patternCacheRef.current?.dispose();
      patternCacheRef.current = null;
    };
  }, [targetA, targetB, simMaterial, seedMaterial, simScene, seedScene]);

  return null; // This component doesn't render anything visible
};
