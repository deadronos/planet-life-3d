import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { gpuSeedFragmentShader } from '../shaders/gpuSeed.frag';
import { simulationFragmentShader } from '../shaders/simulation.frag';
import { simulationVertexShader } from '../shaders/simulation.vert';
import type { Rules } from '../sim/rules';

// Helper to create FBO (Frame Buffer Object / Render Target)
function createRenderTarget(width: number, height: number): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    type: THREE.FloatType,
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
  }) => void;
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

  // Create simulation material with shaders (using ref to avoid useMemo immutability issues)
  const simMaterial = useMemo(() => {
    const birthRules = rulesToFloatArray(rules.birth);
    const surviveRules = rulesToFloatArray(rules.survive);

    return new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: null },
        uResolution: { value: new THREE.Vector2(resolution.width, resolution.height) },
        uBirthRules: { value: birthRules },
        uSurviveRules: { value: surviveRules },
        uColonyMode: { value: gameMode === 'Colony' },
      },
      vertexShader: simulationVertexShader,
      fragmentShader: simulationFragmentShader,
    });
  }, [resolution.height, resolution.width, rules, gameMode]);

  // Separate scene for simulation rendering (doesn't show in main view)
  const simScene = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial);
    scene.add(quad);
    return { scene, camera, quad };
  }, [simMaterial]);

  // Seeding material for writing patterns to texture
  const seedMaterial = useMemo(() => {
    const modeMap = { set: 0, toggle: 1, clear: 2, random: 3 };
    return new THREE.ShaderMaterial({
      uniforms: {
        uCurrentState: { value: null },
        uPatternData: { value: null },
        uResolution: { value: new THREE.Vector2(resolution.width, resolution.height) },
        uSeedCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uPatternSize: { value: new THREE.Vector2(1, 1) },
        uSeedMode: { value: modeMap.set },
        uSeedProbability: { value: 0.5 },
        uColonyMode: { value: gameMode === 'Colony' },
        uRandomSeed: { value: 0 },
      },
      vertexShader: simulationVertexShader,
      fragmentShader: gpuSeedFragmentShader,
    });
  }, [resolution.height, resolution.width, gameMode]);

  const seedScene = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), seedMaterial);
    scene.add(quad);
    return { scene, camera, quad };
  }, [seedMaterial]);

  // Initialize with random or empty state
  useEffect(() => {
    // Initialize buffer A with random data
    const size = resolution.width * resolution.height * 4;
    const data = new Float32Array(size);
    for (let i = 0; i < size; i += 4) {
      let state = 0.0;
      if (Math.random() < randomDensity) {
        if (gameMode === 'Colony') {
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

    // Render initial state to both buffers
    const prevTarget = gl.getRenderTarget();

    // Important: We modify uniforms inside an effect, not during render
    // This is allowed because it's an intentional side effect
    gl.setRenderTarget(targetA);
    gl.clear();
    // eslint-disable-next-line react-hooks/immutability
    simMaterial.uniforms.uTexture.value = texture;
    gl.render(simScene.scene, simScene.camera);

    gl.setRenderTarget(targetB);
    gl.clear();
    gl.render(simScene.scene, simScene.camera);

    gl.setRenderTarget(prevTarget);

    texture.dispose();
  }, [
    resolution.height,
    resolution.width,
    randomDensity,
    gameMode,
    gl,
    simScene,
    simMaterial,
    targetA,
    targetB,
  ]);

  /* eslint-disable react-hooks/immutability */
  // Update rules and game mode when they change
  useEffect(() => {
    const birthRules = rulesToFloatArray(rules.birth);
    const surviveRules = rulesToFloatArray(rules.survive);
    simMaterial.uniforms.uBirthRules.value = birthRules;
    simMaterial.uniforms.uSurviveRules.value = surviveRules;
    simMaterial.uniforms.uColonyMode.value = gameMode === 'Colony';
  }, [rules, gameMode, simMaterial]);
  /* eslint-enable react-hooks/immutability */

  // Expose seeding method via ref
  useImperativeHandle(
    simRef,
    () => ({
      seedAtUV: ({ u, v, pattern, mode, probability = 0.5 }) => {
        // Create pattern texture from 2D array
        const patternHeight = pattern.length;
        const patternWidth = pattern[0]?.length || 0;
        if (patternWidth === 0 || patternHeight === 0) return;

        const patternData = new Float32Array(patternWidth * patternHeight * 4);
        for (let y = 0; y < patternHeight; y++) {
          for (let x = 0; x < patternWidth; x++) {
            const idx = (y * patternWidth + x) * 4;
            const value = pattern[y][x] > 0 ? 1.0 : 0.0;
            patternData[idx] = value;
            patternData[idx + 1] = 0;
            patternData[idx + 2] = 0;
            patternData[idx + 3] = 1;
          }
        }

        const patternTexture = new THREE.DataTexture(
          patternData,
          patternWidth,
          patternHeight,
          THREE.RGBAFormat,
          THREE.FloatType,
        );
        patternTexture.needsUpdate = true;

        // Set seeding uniforms
        const modeMap = { set: 0, toggle: 1, clear: 2, random: 3 };
        seedMaterial.uniforms.uCurrentState.value =
          currentBufferRef.current === 'A' ? targetA.texture : targetB.texture;
        seedMaterial.uniforms.uPatternData.value = patternTexture;
        const seedCenter = seedMaterial.uniforms.uSeedCenter.value as THREE.Vector2;
        seedCenter.set(u, v);
        const patternSize = seedMaterial.uniforms.uPatternSize.value as THREE.Vector2;
        patternSize.set(patternWidth, patternHeight);
        seedMaterial.uniforms.uSeedMode.value = modeMap[mode];
        seedMaterial.uniforms.uSeedProbability.value = probability;
        seedMaterial.uniforms.uRandomSeed.value = Math.random();
        seedMaterial.uniforms.uColonyMode.value = gameMode === 'Colony';

        // Render seeding pass to current buffer
        const prevTarget = gl.getRenderTarget();
        const currentBuffer = currentBufferRef.current === 'A' ? targetA : targetB;
        gl.setRenderTarget(currentBuffer);
        gl.render(seedScene.scene, seedScene.camera);
        gl.setRenderTarget(prevTarget);

        // Notify parent of update
        if (onTextureUpdate) {
          onTextureUpdate(currentBuffer.texture);
        }

        // Cleanup
        patternTexture.dispose();
      },
    }),
    [seedMaterial, seedScene, targetA, targetB, currentBufferRef, gl, gameMode, onTextureUpdate],
  );

  // Simulation update loop with tick speed throttling
  useFrame(() => {
    if (!running) return;

    // Throttle updates based on tickMs
    const now = performance.now();
    const elapsed = now - lastTickTimeRef.current;
    if (elapsed < tickMs) return;

    lastTickTimeRef.current = now;

    // Determine read and write buffers
    const readBuffer = currentBufferRef.current === 'A' ? targetA : targetB;
    const writeBuffer = currentBufferRef.current === 'A' ? targetB : targetA;

    // Render simulation step to write buffer
    // Modifying uniforms in useFrame is allowed - it's a render loop, not React render
    const prevTarget = gl.getRenderTarget();
    gl.setRenderTarget(writeBuffer);
    // eslint-disable-next-line react-hooks/immutability
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
    };
  }, [targetA, targetB, simMaterial, seedMaterial, simScene, seedScene]);

  return null; // This component doesn't render anything visible
};
