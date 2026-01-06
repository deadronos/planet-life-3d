import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import type { Rules } from '../sim/rules';
import { simulationFragmentShader } from '../shaders/simulation.frag';
import { simulationVertexShader } from '../shaders/simulation.vert';

// Helper to create FBO (Frame Buffer Object / Render Target)
function createRenderTarget(resolution: number): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(resolution, resolution, {
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

export function GPUSimulation({
  resolution = 512,
  running = true,
  tickMs = 120,
  rules,
  randomDensity = 0.1,
  onTextureUpdate,
}: {
  resolution?: number;
  running?: boolean;
  tickMs?: number;
  rules: Rules;
  randomDensity?: number;
  onTextureUpdate?: (texture: THREE.Texture) => void;
}) {
  const { gl } = useThree();

  // Ping-pong render targets for double buffering
  const targetA = useMemo(() => createRenderTarget(resolution), [resolution]);
  const targetB = useMemo(() => createRenderTarget(resolution), [resolution]);

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
        uResolution: { value: new THREE.Vector2(resolution, resolution) },
        uBirthRules: { value: birthRules },
        uSurviveRules: { value: surviveRules },
      },
      vertexShader: simulationVertexShader,
      fragmentShader: simulationFragmentShader,
    });
  }, [resolution, rules]);

  // Separate scene for simulation rendering (doesn't show in main view)
  const simScene = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial);
    scene.add(quad);
    return { scene, camera, quad };
  }, [simMaterial]);

  // Initialize with random or empty state
  useEffect(() => {
    // Initialize buffer A with random data
    const size = resolution * resolution * 4;
    const data = new Float32Array(size);
    for (let i = 0; i < size; i += 4) {
      const alive = Math.random() < randomDensity ? 1.0 : 0.0;
      data[i] = alive; // R: alive/dead
      data[i + 1] = 0.0; // G: age
      data[i + 2] = 0.0; // B: heat
      data[i + 3] = 1.0; // A: always 1
    }

    const texture = new THREE.DataTexture(
      data,
      resolution,
      resolution,
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
  }, [resolution, randomDensity, gl, simScene, simMaterial, targetA, targetB]);

  // Update rules when they change
  useEffect(() => {
    const birthRules = rulesToFloatArray(rules.birth);
    const surviveRules = rulesToFloatArray(rules.survive);
    // eslint-disable-next-line react-hooks/immutability
    simMaterial.uniforms.uBirthRules.value = birthRules;
    // eslint-disable-next-line react-hooks/immutability
    simMaterial.uniforms.uSurviveRules.value = surviveRules;
  }, [rules, simMaterial]);

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
      simScene.quad.geometry.dispose();
    };
  }, [targetA, targetB, simMaterial, simScene]);

  return null; // This component doesn't render anything visible
}
