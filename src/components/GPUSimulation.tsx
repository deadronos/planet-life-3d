/* eslint-disable react-hooks/immutability */
import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { gpuSeedFragmentShader } from '../shaders/gpuSeed.frag';
import { gpuStatsFragmentShader } from '../shaders/gpuStats.frag';
import { simulationFragmentShader } from '../shaders/simulation.frag';
import { simulationVertexShader } from '../shaders/simulation.vert';
import { ECOLOGY_PROFILES, type EcologyProfileName } from '../sim/ecology';
import type { Rules } from '../sim/rules';
import { PatternTextureCache } from './patternTextureCache';
import { isStatsReadbackDue, sumStatsPixels } from './planetLife/gpuStats';

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

/** A stats readback request that has not been issued yet. */
type PendingStatsRead = {
  current: THREE.Texture;
  prev: THREE.Texture;
  generation: number;
  /** Render generation this request's textures belong to. */
  epoch: number;
};

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
  onStats?: (stats: {
    generation: number;
    population: number;
    birthsLastTick: number;
    deathsLastTick: number;
  }) => void;
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

  // Generation counter for the HUD. Reset whenever the world is
  // re-initialized (randomize / clear).
  const generationRef = useRef(0);

  // Reusable readback buffer for HUD stats (avoids a per-tick allocation).
  const statsBufferRef = useRef<Uint8Array | null>(null);

  // Count of stats readback requests, used to throttle to every Nth call.
  const statsTickRef = useRef(0);

  // Guards against overlapping async readbacks. The stats target is
  // re-rendered on every read, so a second read issued while the first is
  // still in flight would sample a half-written frame and report garbage.
  const statsReadInFlightRef = useRef(false);

  // Identifies which generation of the render targets a readback belongs to.
  // A resolution change disposes the old targets, so a read issued against
  // them must neither publish its result nor be re-issued - doing so would
  // make three.js lazily re-allocate a framebuffer/texture pair that no
  // cleanup will ever free.
  const statsEpochRef = useRef(0);

  // Holds the newest read implementation so a deferred request is re-issued
  // with current targets rather than those captured by an older render.
  const performStatsReadRef = useRef<typeof performStatsRead>(() => {
    /* replaced below */
  });

  // A read that arrives while one is in flight is deferred here and re-issued
  // when the in-flight read settles. Dropping it instead would strand the HUD:
  // a paused simulation never enters useFrame, so a discarded readback would
  // never be retried and the stats would stay wrong until the next user action.
  const statsPendingRef = useRef<PendingStatsRead | null>(null);

  // Async readbacks resolve after the frame that requested them; publishing
  // to a parent that has already unmounted would warn and leak work.
  const statsMountedRef = useRef(true);
  useEffect(() => {
    statsMountedRef.current = true;
    return () => {
      statsMountedRef.current = false;
      statsPendingRef.current = null;
    };
  }, []);

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
        uEcologyEnabled: { value: ecologyProfile !== 'None' },
        uEcologyFertilityBias: {
          value: (ECOLOGY_PROFILES[ecologyProfile] ?? ECOLOGY_PROFILES.None).fertilityBias,
        },
        uEcologyDroughtBias: {
          value: (ECOLOGY_PROFILES[ecologyProfile] ?? ECOLOGY_PROFILES.None).droughtBias,
        },
        uEcologyMountainBias: {
          value: (ECOLOGY_PROFILES[ecologyProfile] ?? ECOLOGY_PROFILES.None).mountainBias,
        },
        uEcologySunlightBias: {
          value: (ECOLOGY_PROFILES[ecologyProfile] ?? ECOLOGY_PROFILES.None).sunlightBias,
        },
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

  // Stats target + pass: renders birth/death/alive buckets for the HUD so
  // the main thread can read back real population numbers instead of
  // relying on the (now paused) CPU sim.
  const statsTarget = useMemo(
    () => createRenderTarget(resolution.width, resolution.height),
    [resolution.height, resolution.width],
  );

  const statsMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uPrevState: { value: null },
        uCurrentState: { value: null },
      },
      vertexShader: simulationVertexShader,
      fragmentShader: gpuStatsFragmentShader,
    });
  }, []);

  const statsScene = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), statsMaterial);
    scene.add(quad);
    return { scene, camera, quad };
  }, [statsMaterial]);

  // Render the birth/death/alive classification for (prev -> current) into
  // the stats target, read it back, and publish HUD stats.
  //
  // Two things keep this off the critical path:
  //
  // 1. Throttling. `gl.readRenderTargetPixels` is a synchronous
  //    synchronisation point - the CPU blocks until the GPU has drained its
  //    queued commands, which destroys CPU/GPU pipelining for the whole
  //    frame. The transfer size is secondary to that stall, and at up to
  //    256x512 the buffer is 512KB. The HUD only needs a coarse trend, so we
  //    sample every Nth call rather than every tick.
  // 2. Async readback. Where the renderer supports it we use the PBO +
  //    fenceSync path, which never blocks the render loop at all.
  //
  // Split from `readStats` so the deferred-request path can re-issue a read
  // without re-entering the throttle bookkeeping.
  const performStatsRead = useCallback(
    (current: THREE.Texture, prev: THREE.Texture, generation: number, epoch: number) => {
      const prevTarget = gl.getRenderTarget();
      statsMaterial.uniforms.uPrevState.value = prev;
      statsMaterial.uniforms.uCurrentState.value = current;
      gl.setRenderTarget(statsTarget);
      gl.render(statsScene.scene, statsScene.camera);
      gl.setRenderTarget(prevTarget);

      const w = resolution.width;
      const h = resolution.height;
      const texelCount = w * h;
      const needed = texelCount * 4;
      if (!statsBufferRef.current || statsBufferRef.current.length < needed) {
        statsBufferRef.current = new Uint8Array(needed);
      }
      const pixels = statsBufferRef.current;

      const publish = () => {
        if (!statsMountedRef.current || !onStats) return;
        // The targets this read was issued against have been disposed by a
        // resolution change; its figures describe a world that no longer exists.
        if (epoch !== statsEpochRef.current) return;
        // Bound the reduction to the texels this readback refreshed; the
        // shared buffer is reused and may be larger after a resolution drop.
        const totals = sumStatsPixels(pixels, texelCount);
        onStats({
          generation,
          population: totals.population,
          birthsLastTick: totals.births,
          deathsLastTick: totals.deaths,
        });
      };

      // Release the in-flight lock and re-issue any request that arrived
      // while this read was outstanding, so a user action is never lost.
      const settle = () => {
        statsReadInFlightRef.current = false;
        const pending = statsPendingRef.current;
        statsPendingRef.current = null;
        if (!pending || !statsMountedRef.current) return;
        // Same rule as publish: never let a request whose textures belong to
        // a superseded render drive a read against disposed targets.
        if (pending.epoch !== statsEpochRef.current) return;
        // Re-issue through the newest read implementation, not this closure:
        // the render targets may have been rebuilt since this read started.
        performStatsReadRef.current(
          pending.current,
          pending.prev,
          pending.generation,
          pending.epoch,
        );
      };

      // Prefer the non-blocking path; fall back to the synchronous read only
      // if the renderer predates readRenderTargetPixelsAsync.
      if (typeof gl.readRenderTargetPixelsAsync === 'function') {
        statsReadInFlightRef.current = true;
        gl.readRenderTargetPixelsAsync(statsTarget, 0, 0, w, h, pixels)
          .then(publish)
          .catch((err: unknown) => {
            // A failed readback must never take down the render loop; the HUD
            // simply keeps its previous values until the next attempt.
            // eslint-disable-next-line no-console
            console.warn('[GPUSimulation] async stats readback failed', err);
          })
          .finally(settle);
        return;
      }

      const target = gl.getRenderTarget();
      gl.readRenderTargetPixels(statsTarget, 0, 0, w, h, pixels);
      gl.setRenderTarget(target);
      publish();
      settle();
    },
    [gl, onStats, resolution.height, resolution.width, statsMaterial, statsScene, statsTarget],
  );

  /**
   * Request a stats readback, subject to the throttle.
   *
   * `force` bypasses the throttle for discrete user actions (randomize,
   * clear, single-step) where showing stale figures would be confusing.
   */
  const readStats = useCallback(
    (current: THREE.Texture, prev: THREE.Texture, force = false) => {
      if (!onStats) return;

      // Evaluate the cadence against the current counter, then advance it. Testing
      // before incrementing means the very first request is due (counter is 0),
      // so the HUD populates immediately instead of waiting a full interval.
      const due = isStatsReadbackDue(statsTickRef.current);
      statsTickRef.current += 1;
      if (!force && !due) return;

      const epoch = statsEpochRef.current;

      // Defer rather than discard: the stats target is about to be
      // overwritten, so a concurrent read would sample a partially written
      // frame. The pending slot holds the latest request so the HUD always
      // reflects the most recent user action.
      if (statsReadInFlightRef.current) {
        statsPendingRef.current = { current, prev, generation: generationRef.current, epoch };
        return;
      }

      performStatsRead(current, prev, generationRef.current, epoch);
    },
    [onStats, performStatsRead],
  );

  // Advance the render generation and publish the newest read implementation.
  //
  // This effect is declared *before* the initialization effect below on
  // purpose: React runs cleanups before setups and mounts effects in
  // declaration order, so by the time initialization issues its forced
  // readback the epoch and the read implementation both describe the freshly
  // built targets. Reads still in flight from the previous generation are
  // recognised as stale and their deferred work is discarded.
  useEffect(() => {
    statsEpochRef.current += 1;
    performStatsReadRef.current = performStatsRead;
    return () => {
      statsPendingRef.current = null;
    };
  }, [performStatsRead, statsTarget]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Update ecology params in place when the profile changes (same rationale
  // as the rules effect: recreate the material and the sim is wiped).
  useEffect(() => {
    const profile = ECOLOGY_PROFILES[ecologyProfile] ?? ECOLOGY_PROFILES.None;
    simMaterial.uniforms.uEcologyEnabled.value = ecologyProfile !== 'None';
    simMaterial.uniforms.uEcologyFertilityBias.value = profile.fertilityBias;
    simMaterial.uniforms.uEcologyDroughtBias.value = profile.droughtBias;
    simMaterial.uniforms.uEcologyMountainBias.value = profile.mountainBias;
    simMaterial.uniforms.uEcologySunlightBias.value = profile.sunlightBias;
  }, [ecologyProfile, simMaterial]);

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
        const readTexture = readBuffer.texture;
        const writeTexture = writeBuffer.texture;
        gl.setRenderTarget(writeBuffer);
        // Ensure the shader sees the current state texture
        seedMaterial.uniforms.uCurrentState.value = readTexture;
        gl.render(seedScene.scene, seedScene.camera);
        gl.setRenderTarget(prevTarget);

        // Swap buffers: the newly written buffer becomes the current/read buffer
        currentBufferRef.current = currentBufferRef.current === 'A' ? 'B' : 'A';

        // Seeding changes population immediately, but meteor showers can fire
        // many impacts per tick - let the throttle decide rather than forcing
        // a readback per impact.
        readStats(writeTexture, readTexture);

        // Notify parent of update
        if (onTextureUpdate) {
          onTextureUpdate(writeTexture);
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
        const readTexture = readBuffer.texture;
        const writeTexture = writeBuffer.texture;
        const prevTarget = gl.getRenderTarget();
        gl.setRenderTarget(writeBuffer);
        simMaterial.uniforms.uTexture.value = readTexture;
        gl.render(simScene.scene, simScene.camera);
        gl.setRenderTarget(prevTarget);
        currentBufferRef.current = currentBufferRef.current === 'A' ? 'B' : 'A';
        generationRef.current += 1;
        // Explicit single-step from the UI: report the new generation now.
        readStats(writeTexture, readTexture, true);
        if (onTextureUpdate) {
          onTextureUpdate(writeTexture);
        }
      },
    }),
    [
      initializeState,
      randomDensity,
      readStats,
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
    const readTexture = readBuffer.texture;
    const writeTexture = writeBuffer.texture;

    // Render simulation step to write buffer
    // Modifying uniforms in useFrame is allowed - it's a render loop, not React render
    const prevTarget = gl.getRenderTarget();
    gl.setRenderTarget(writeBuffer);
    simMaterial.uniforms.uTexture.value = readTexture;
    gl.render(simScene.scene, simScene.camera);
    gl.setRenderTarget(prevTarget);

    // Swap buffers
    currentBufferRef.current = currentBufferRef.current === 'A' ? 'B' : 'A';
    generationRef.current += 1;
    readStats(writeTexture, readTexture);

    // Notify parent of texture update
    if (onTextureUpdate) {
      onTextureUpdate(writeTexture);
    }
  });

  // Cleanup
  useEffect(() => {
    return () => {
      targetA.dispose();
      targetB.dispose();
      statsTarget.dispose();
      simMaterial.dispose();
      seedMaterial.dispose();
      statsMaterial.dispose();
      simScene.quad.geometry.dispose();
      seedScene.quad.geometry.dispose();
      statsScene.quad.geometry.dispose();
      patternCacheRef.current?.dispose();
      patternCacheRef.current = null;
    };
  }, [
    targetA,
    targetB,
    statsTarget,
    simMaterial,
    seedMaterial,
    statsMaterial,
    simScene,
    seedScene,
    statsScene,
  ]);

  return null; // This component doesn't render anything visible
};
