// @ts-ignore
import { useFBO } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { simulationVertexShader, simulationFragmentShader, seedFragmentShader } from './shaders';

interface GpuSimulationProps {
  width: number;
  height: number;
  birthRules: boolean[]; // length 9
  surviveRules: boolean[]; // length 9
  running: boolean;
  tickMs: number;
  targetMaterial: React.MutableRefObject<THREE.MeshBasicMaterial | null>;
  randomizeTrigger: number;
  clearTrigger: number;
  stepOnceTrigger: number;
  randomDensity: number;
}

export function GpuSimulation({
  width,
  height,
  birthRules,
  surviveRules,
  running,
  tickMs,
  targetMaterial,
  randomizeTrigger,
  clearTrigger,
  stepOnceTrigger,
  randomDensity,
}: GpuSimulationProps) {
  const { gl } = useThree();

  // 1. Create Ping-Pong Buffers
  const options = useMemo<THREE.RenderTargetOptions>(() => ({
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    type: THREE.UnsignedByteType, // Compatible with all devices
    wrapS: THREE.RepeatWrapping, // Wrap longitude
    wrapT: THREE.ClampToEdgeWrapping, // Clamp latitude
    format: THREE.RGBAFormat, // Standard format
  }), []);

  const bufferA = useFBO(width, height, options);
  const bufferB = useFBO(width, height, options);

  // Refs to keep track of current/next buffers
  const bufferRef = useRef({
    current: bufferA,
    next: bufferB,
  });

  // 2. Create Simulation Material
  const simMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: null },
      uResolution: { value: new THREE.Vector2(width, height) },
      uBirth: { value: birthRules },
      uSurvive: { value: surviveRules },
    },
    vertexShader: simulationVertexShader,
    fragmentShader: simulationFragmentShader,
  }), [width, height, birthRules, surviveRules]);

  // Update uniforms when rules or size change
  useEffect(() => {
    simMaterial.uniforms.uBirth.value = birthRules;
    simMaterial.uniforms.uSurvive.value = surviveRules;
    simMaterial.uniforms.uResolution.value.set(width, height);
  }, [birthRules, surviveRules, width, height, simMaterial]);


  // 3. Create Seed Material
  const seedMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uSeed: { value: 0 },
      uDensity: { value: randomDensity },
    },
    vertexShader: simulationVertexShader, // Reuse quad vert
    fragmentShader: seedFragmentShader,
  }), [randomDensity]);

  useEffect(() => {
    seedMaterial.uniforms.uDensity.value = randomDensity;
  }, [randomDensity, seedMaterial]);


  // 4. Create Simulation Scene (Quad)
  const simScene = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    camera.position.z = 1; // Pull camera back to ensure quad is visible
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial);
    scene.add(quad);
    return { scene, camera, quad };
  }, [simMaterial]);

  // Helper to swap buffers
  const swapBuffers = () => {
    const temp = bufferRef.current.current;
    bufferRef.current.current = bufferRef.current.next;
    bufferRef.current.next = temp;
  };

  // Helper to update the target material's map
  const updateMaterialMap = () => {
      if (targetMaterial.current) {
          targetMaterial.current.map = bufferRef.current.current.texture;
          targetMaterial.current.needsUpdate = true;
      }
  };

  // Apply texture immediately on mount/change
  useLayoutEffect(() => {
      updateMaterialMap();
  });

  // 5. Handle Triggers (Randomize, Clear, StepOnce)
  const lastRandomizeRef = useRef(randomizeTrigger);
  const lastClearRef = useRef(clearTrigger);
  const lastStepOnceRef = useRef(stepOnceTrigger);

  // Effect for Randomize and Clear (can be async/outside loop)
  useEffect(() => {
    // Randomize
    if (randomizeTrigger !== lastRandomizeRef.current) {
        lastRandomizeRef.current = randomizeTrigger;

        // console.log('[GpuSimulation] Randomizing...', { width, height, density: randomDensity });

        simScene.quad.material = seedMaterial;
        seedMaterial.uniforms.uSeed.value = Math.random() * 1000;

        const target = bufferRef.current.current;
        gl.setRenderTarget(target);
        gl.render(simScene.scene, simScene.camera);
        gl.setRenderTarget(null);

        simScene.quad.material = simMaterial;
        updateMaterialMap();
    }

    // Clear
    if (clearTrigger !== lastClearRef.current) {
        lastClearRef.current = clearTrigger;

        // console.log('[GpuSimulation] Clearing...');

        const target = bufferRef.current.current;
        gl.setRenderTarget(target);
        gl.clearColor(0, 0, 0, 1); // Clear to black (dead)
        gl.clear(true, true, true);
        gl.setRenderTarget(null);

        // Also clear the next buffer to be safe
        gl.setRenderTarget(bufferRef.current.next);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(true, true, true);
        gl.setRenderTarget(null);

        updateMaterialMap();
    }
  }, [randomizeTrigger, clearTrigger, gl, simScene, seedMaterial, width, height, randomDensity]);


  // 6. The Render Loop
  const timerRef = useRef(0);
  const frameCountRef = useRef(0);

  useFrame((state, delta) => {
    let shouldStep = false;

    // Check StepOnce
    if (stepOnceTrigger !== lastStepOnceRef.current) {
        lastStepOnceRef.current = stepOnceTrigger;
        shouldStep = true;
    }
    // Check Running + Timer
    else if (running) {
        timerRef.current += delta * 1000;
        if (timerRef.current >= tickMs) {
            timerRef.current = 0;
            shouldStep = true;
        }
    }

    if (!shouldStep) {
        // Even if not stepping, ensure the material map is correct (e.g. after remount)
        // Optimization: Check if map matches current buffer
        if (targetMaterial.current && targetMaterial.current.map !== bufferRef.current.current.texture) {
             updateMaterialMap();
        }
        return;
    }

    // Debug logging (throttled)
    // frameCountRef.current++;
    // if (frameCountRef.current % 60 === 0) {
    //    console.log('[GpuSimulation] Stepping', { tickMs, delta, width, height });
    // }

    const currentBuffer = bufferRef.current.current;
    const nextBuffer = bufferRef.current.next;

    // A. Render simulation step to next buffer
    gl.setRenderTarget(nextBuffer);
    simMaterial.uniforms.uTexture.value = currentBuffer.texture;
    gl.render(simScene.scene, simScene.camera);

    // B. Reset render target
    gl.setRenderTarget(null);

    // C. Swap
    swapBuffers();

    // D. Update parent material
    updateMaterialMap();
  });

  return null;
}
