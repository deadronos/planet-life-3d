import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { button, folder, useControls } from 'leva';
import type { ThreeEvent } from '@react-three/fiber';
import { LifeSphereSim, parseRuleDigits } from '../sim/LifeSphereSim';
import {
  BUILTIN_PATTERN_NAMES,
  getBuiltinPatternOffsets,
  parseAsciiPattern,
} from '../sim/patterns';
import { Meteor, type MeteorSpec } from './Meteor';
import { ImpactRing, type ImpactSpec } from './ImpactRing';
import { useUIStore } from '../store/useUIStore';

function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

function safeInt(v: unknown, fallback: number, lo: number, hi: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  const f = Math.floor(n);
  return f < lo ? lo : f > hi ? hi : f;
}

type PlanetLifeControls = {
  running: boolean;
  tickMs: number;
  latCells: number;
  lonCells: number;
  birthDigits: string;
  surviveDigits: string;
  randomDensity: number;
  planetRadius: number;
  planetWireframe: boolean;
  planetRoughness: number;
  rimIntensity: number;
  rimPower: number;
  terminatorSharpness: number;
  terminatorBoost: number;
  atmosphereColor: string;
  atmosphereIntensity: number;
  atmosphereHeight: number;
  cellRenderMode: 'Texture' | 'Dots' | 'Both';
  cellOverlayOpacity: number;
  cellRadius: number;
  cellLift: number;
  cellColor: string;
  cellColorMode: 'Solid' | 'Age Fade' | 'Neighbor Heat';
  ageFadeHalfLife: number;
  heatLowColor: string;
  heatMidColor: string;
  heatHighColor: string;
  meteorSpeed: number;
  meteorRadius: number;
  meteorCooldownMs: number;
  meteorTrailLength: number;
  meteorTrailWidth: number;
  meteorEmissive: number;
  impactFlashIntensity: number;
  impactFlashRadius: number;
  impactRingColor: string;
  impactRingDuration: number;
  impactRingSize: number;
  seedMode: 'set' | 'toggle' | 'clear' | 'random';
  seedPattern: string;
  seedScale: number;
  seedJitter: number;
  seedProbability: number;
  customPattern: string;
};

export function PlanetLife() {
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const patternOptions = useMemo(
    () => [...BUILTIN_PATTERN_NAMES, 'Custom ASCII', 'Random Disk'],
    [],
  );

  const params = useControls({
    Simulation: folder(
      {
        running: true,
        tickMs: { value: 120, min: 10, max: 1500, step: 1 },
        latCells: { value: 48, min: 8, max: 140, step: 1 },
        lonCells: { value: 96, min: 8, max: 240, step: 1 },
        birthDigits: { value: '3' },
        surviveDigits: { value: '23' },
        randomDensity: { value: 0.14, min: 0, max: 1, step: 0.01 },
      },
      { collapsed: false },
    ),

    Rendering: folder(
      {
        planetRadius: { value: 2.6, min: 1.2, max: 6, step: 0.05 },
        planetWireframe: false,
        planetRoughness: { value: 0.9, min: 0.05, max: 1, step: 0.01 },
        cellRenderMode: {
          value: 'Texture' as const,
          options: ['Texture', 'Dots', 'Both'] as const,
        },
        cellOverlayOpacity: { value: 1, min: 0, max: 2, step: 0.01 },
        cellRadius: { value: 0.05, min: 0.01, max: 0.15, step: 0.005 },
        cellLift: { value: 0.04, min: 0, max: 0.25, step: 0.005 },
        cellColor: '#3dd54c',
      },
      { collapsed: true },
    ),

    Upgrades: folder(
      {
        rimIntensity: { value: 0.65, min: 0, max: 2, step: 0.01 },
        rimPower: { value: 2.6, min: 0.5, max: 6, step: 0.05 },
        terminatorSharpness: { value: 1.4, min: 0.2, max: 4, step: 0.05 },
        terminatorBoost: { value: 0.35, min: 0, max: 1, step: 0.01 },
        atmosphereColor: '#64d4ff',
        atmosphereIntensity: { value: 0.55, min: 0, max: 2, step: 0.01 },
        atmosphereHeight: { value: 0.06, min: 0, max: 0.35, step: 0.005 },
        cellColorMode: {
          value: 'Neighbor Heat' as const,
          options: ['Solid', 'Age Fade', 'Neighbor Heat'] as const,
        },
        ageFadeHalfLife: { value: 24, min: 2, max: 160, step: 1 },
        heatLowColor: '#2ee488',
        heatMidColor: '#f0d96a',
        heatHighColor: '#ff6b55',
        meteorTrailLength: { value: 0.9, min: 0.2, max: 3, step: 0.05 },
        meteorTrailWidth: { value: 0.12, min: 0.02, max: 0.4, step: 0.01 },
        meteorEmissive: { value: 2.6, min: 0.2, max: 5, step: 0.05 },
        impactFlashIntensity: { value: 1.5, min: 0, max: 4, step: 0.05 },
        impactFlashRadius: { value: 0.45, min: 0.05, max: 2, step: 0.05 },
        impactRingColor: '#ffeeaa',
        impactRingDuration: { value: 0.9, min: 0.2, max: 2, step: 0.05 },
        impactRingSize: { value: 1, min: 0.4, max: 2.5, step: 0.05 },
      },
      { collapsed: true },
    ),

    Meteors: folder(
      {
        meteorSpeed: { value: 10, min: 1, max: 40, step: 0.5 },
        meteorRadius: { value: 0.08, min: 0.02, max: 0.3, step: 0.01 },
        meteorCooldownMs: { value: 120, min: 0, max: 1000, step: 10 },
      },
      { collapsed: true },
    ),

    Seeding: folder(
      {
        seedMode: {
          value: 'set' as const,
          options: ['set', 'toggle', 'clear', 'random'] as const,
        },
        seedPattern: { value: 'Glider', options: patternOptions },
        seedScale: { value: 1, min: 1, max: 8, step: 1 },
        seedJitter: { value: 0, min: 0, max: 6, step: 1 },
        seedProbability: { value: 0.7, min: 0, max: 1, step: 0.01 },
        customPattern: {
          value: `
..O..
...O.
.OOO.
`.trim(),
        },
      },
      { collapsed: false },
    ),

    Debug: folder(
      {
        debugLogs: false,
      },
      { collapsed: true },
    ),
  }) as unknown as PlanetLifeControls & { debugLogs: boolean };

  const {
    running,
    tickMs,
    latCells,
    lonCells,
    birthDigits,
    surviveDigits,
    randomDensity,

    planetRadius,
    planetWireframe,
    planetRoughness,
    rimIntensity,
    rimPower,
    terminatorSharpness,
    terminatorBoost,
    atmosphereColor,
    atmosphereIntensity,
    atmosphereHeight,

    cellRenderMode,
    cellOverlayOpacity,

    cellRadius,
    cellLift,
    cellColor,
    cellColorMode,
    ageFadeHalfLife,
    heatLowColor,
    heatMidColor,
    heatHighColor,

    meteorSpeed,
    meteorRadius,
    meteorCooldownMs,
    meteorTrailLength,
    meteorTrailWidth,
    meteorEmissive,
    impactFlashIntensity,
    impactFlashRadius,
    impactRingColor,
    impactRingDuration,
    impactRingSize,

    seedMode,
    seedPattern,
    seedScale,
    seedJitter,
    seedProbability,
    customPattern,

    debugLogs,
  } = params;

  const rules = useMemo(() => {
    return {
      birth: parseRuleDigits(birthDigits),
      survive: parseRuleDigits(surviveDigits),
    };
  }, [birthDigits, surviveDigits]);

  const simRef = useRef<LifeSphereSim | null>(null);
  const cellsRef = useRef<THREE.InstancedMesh | null>(null);
  const lastShotMsRef = useRef(0);

  const [meteors, setMeteors] = useState<MeteorSpec[]>([]);
  const [impacts, setImpacts] = useState<ImpactSpec[]>([]);

  const safeLatCells = useMemo(() => safeInt(latCells, 48, 8, 256), [latCells]);
  const safeLonCells = useMemo(() => safeInt(lonCells, 96, 8, 512), [lonCells]);
  const maxInstances = useMemo(() => safeLatCells * safeLonCells, [safeLatCells, safeLonCells]);

  // Life overlay texture: lonCells x latCells (equirectangular)
  const lifeTex = useMemo(() => {
    const w = safeLonCells;
    const h = safeLatCells;
    const data = new Uint8Array(w * h * 4);
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.flipY = false;
    // colorSpace is the modern three.js name; tolerate older builds.
    try {
      (tex as unknown as Record<string, unknown>)['colorSpace'] = (
        THREE as unknown as Record<string, unknown>
      )['SRGBColorSpace'];
    } catch {
      /* noop */
    }
    tex.needsUpdate = true;
    return { data, tex, w, h };
  }, [safeLatCells, safeLonCells]);

  useEffect(() => {
    return () => {
      lifeTex.tex.dispose();
    };
  }, [lifeTex]);

  const solidColor = useMemo(() => new THREE.Color(cellColor), [cellColor]);

  const heatLowColorObj = useMemo(() => new THREE.Color(heatLowColor), [heatLowColor]);
  const heatMidColorObj = useMemo(() => new THREE.Color(heatMidColor), [heatMidColor]);
  const heatHighColorObj = useMemo(() => new THREE.Color(heatHighColor), [heatHighColor]);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const ageHalfLife = useMemo(() => Math.max(1, ageFadeHalfLife), [ageFadeHalfLife]);

  const resolveCellColor = useCallback(
    (idx: number, ageView: Uint8Array, neighborHeatView: Uint8Array, target: THREE.Color) => {
      switch (cellColorMode) {
        case 'Age Fade': {
          const age = ageView[idx];
          const decay = Math.exp(-age / ageHalfLife);
          const brightness = THREE.MathUtils.clamp(0.35 + decay * 0.75, 0.25, 1.2);
          target.copy(solidColor).multiplyScalar(brightness);
          break;
        }
        case 'Neighbor Heat': {
          const n = neighborHeatView[idx];
          const t = Math.min(1, Math.max(0, n / 8));
          if (t <= 0.5) {
            target.copy(heatLowColorObj).lerp(heatMidColorObj, t * 2);
          } else {
            target.copy(heatMidColorObj).lerp(heatHighColorObj, (t - 0.5) * 2);
          }
          break;
        }
        case 'Solid':
        default:
          target.copy(solidColor);
          break;
      }
      target.r = Math.min(1, target.r);
      target.g = Math.min(1, target.g);
      target.b = Math.min(1, target.b);
      return Math.max(target.r, target.g, target.b);
    },
    [cellColorMode, heatHighColorObj, heatLowColorObj, heatMidColorObj, ageHalfLife, solidColor],
  );

  const rimLightDir = useMemo(() => new THREE.Vector3(6, 6, 8).normalize(), []);

  const planetMaterial = useMemo(() => {
    const uniforms = {
      uDayColor: { value: new THREE.Color('#1a1f2a') },
      uNightColor: { value: new THREE.Color('#0c0e15') },
      uRimColor: { value: new THREE.Color('#64d4ff') },
      uLightDir: { value: new THREE.Vector3(0.6, 0.7, 0.6).normalize() },
      uRimPower: { value: 2.2 },
      uRimIntensity: { value: 0.7 },
      uTerminatorSharpness: { value: 1.2 },
      uTerminatorBoost: { value: 0.3 },
      uAmbientFloor: { value: 0.2 },
    } satisfies Record<string, { value: THREE.Vector3 | THREE.Color | number }>;

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uDayColor;
        uniform vec3 uNightColor;
        uniform vec3 uRimColor;
        uniform vec3 uLightDir;
        uniform float uRimPower;
        uniform float uRimIntensity;
        uniform float uTerminatorSharpness;
        uniform float uTerminatorBoost;
        uniform float uAmbientFloor;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec3 n = normalize(vNormal);
          vec3 l = normalize(uLightDir);
          float ndl = max(0.0, dot(n, l));
          float shade = pow(ndl, uTerminatorSharpness);
          shade = max(shade, uAmbientFloor);
          shade = clamp(shade * (1.0 + uTerminatorBoost), 0.0, 1.0);
          vec3 base = mix(uNightColor, uDayColor, shade);
          float rim = pow(1.0 - max(0.0, dot(n, normalize(vViewDir))), uRimPower) * uRimIntensity;
          vec3 color = base + rim * uRimColor;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    material.toneMapped = true;
    material.depthWrite = true;
    return material;
  }, []);

  useEffect(() => {
    const u = planetMaterial.uniforms as unknown as {
      uDayColor: { value: THREE.Color };
      uNightColor: { value: THREE.Color };
      uRimColor: { value: THREE.Color };
      uLightDir: { value: THREE.Vector3 };
      uRimPower: { value: number };
      uRimIntensity: { value: number };
      uTerminatorSharpness: { value: number };
      uTerminatorBoost: { value: number };
      uAmbientFloor: { value: number };
    };

    u.uRimColor.value.set(atmosphereColor);
    u.uRimIntensity.value = rimIntensity;
    u.uRimPower.value = rimPower;
    u.uTerminatorSharpness.value = terminatorSharpness;
    u.uTerminatorBoost.value = terminatorBoost;
    u.uLightDir.value.copy(rimLightDir);
    u.uAmbientFloor.value = THREE.MathUtils.clamp(planetRoughness * 0.65, 0.05, 0.95);
    u.uDayColor.value.set('#1a1f2a');
    u.uNightColor.value.set('#0c0e15');
    planetMaterial.wireframe = planetWireframe;
  }, [
    planetMaterial,
    atmosphereColor,
    rimIntensity,
    rimPower,
    terminatorSharpness,
    terminatorBoost,
    rimLightDir,
    planetRoughness,
    planetWireframe,
  ]);

  useEffect(() => {
    return () => planetMaterial.dispose();
  }, [planetMaterial]);

  const updateTexture = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;

    const grid = sim.getGridView();
    const ages = sim.getAgeView();
    const heat = sim.getNeighborHeatView();
    const { data, tex, w, h } = lifeTex;

    let aliveCount = 0;
    // Map sim lat index 0 (south pole) to texture v=0 (bottom).
    // DataTexture (flipY=false) maps row 0 to V=0.
    for (let la = 0; la < h; la++) {
      const srcRow = la * w;
      const dstRow = la * w;
      for (let lo = 0; lo < w; lo++) {
        const idx = srcRow + lo;
        const alive = grid[idx] === 1;
        // Three.js SphereGeometry UVs run opposite to our generic Lon mapping.
        // Our Sim: u=0.25 -> -90 deg. Three.js u=0.25 -> +90 deg.
        // So we map Sim column `lo` to Texture column `w - 1 - lo`.
        const dstLo = w - 1 - lo;
        const di = (dstRow + dstLo) * 4;
        if (alive) {
          aliveCount++;
          const intensity = resolveCellColor(idx, ages, heat, colorScratch);
          data[di + 0] = Math.round(colorScratch.r * 255);
          data[di + 1] = Math.round(colorScratch.g * 255);
          data[di + 2] = Math.round(colorScratch.b * 255);
          data[di + 3] = Math.round(255 * Math.min(1, Math.max(0.05, intensity)));
        } else {
          data[di + 0] = 0;
          data[di + 1] = 0;
          data[di + 2] = 0;
          data[di + 3] = 0;
        }
      }
    }

    if (aliveCount > 0 && debugLogs && Math.random() < 0.01) {
      // eslint-disable-next-line no-console
      console.log(`[PlanetLife] updateTexture: alive=${aliveCount}`);
    }

    tex.needsUpdate = true;
  }, [lifeTex, resolveCellColor, colorScratch, debugLogs]);

  const currentPatternOffsets = useMemo(() => {
    if (seedPattern === 'Custom ASCII') return parseAsciiPattern(customPattern);
    if (seedPattern === 'Random Disk') return []; // generated at impact
    return getBuiltinPatternOffsets(seedPattern);
  }, [seedPattern, customPattern]);

  const randomDiskOffsets = useCallback(() => {
    // Disk radius uses seedScale as size knob (handy and cheap)
    const r = Math.max(1, Math.floor(seedScale)) * 2;
    const offsets: Array<readonly [number, number]> = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) offsets.push([dy, dx]);
      }
    }
    return offsets;
  }, [seedScale]);

  const updateInstances = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;

    // Keep the planet overlay in sync with the sim (works even in Texture-only mode).
    updateTexture();

    const mesh = cellsRef.current;
    if (!mesh) return;

    const ages = sim.getAgeView();
    const heat = sim.getNeighborHeatView();

    let i = 0;
    sim.forEachAlive((idx) => {
      dummy.position.copy(sim.positions[idx]);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      resolveCellColor(idx, ages, heat, colorScratch);
      mesh.setColorAt(i, colorScratch);
      i++;
    });
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [dummy, updateTexture, resolveCellColor, colorScratch]);

  const clear = useCallback(() => {
    simRef.current?.clear();
    updateInstances();
  }, [updateInstances]);

  const randomize = useCallback(() => {
    simRef.current?.randomize(randomDensity);
    updateInstances();
  }, [randomDensity, updateInstances]);

  const stepOnce = useCallback(() => {
    simRef.current?.step();
    updateInstances();
  }, [updateInstances]);

  // Actions folder (buttons)
  useControls(
    'Actions',
    () => ({
      Randomize: button(() => randomize()),
      Clear: button(() => clear()),
      StepOnce: button(() => stepOnce()),
    }),
    [randomize, clear, stepOnce],
  );

  // (Re)create sim when grid or planet sizing changes
  useEffect(() => {
    simRef.current = new LifeSphereSim({
      latCells: safeLatCells,
      lonCells: safeLonCells,
      planetRadius,
      cellLift,
      rules,
    });
    simRef.current.randomize(randomDensity);
    updateInstances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeLatCells, safeLonCells, planetRadius, cellLift, rules]);

  // Update rules without resetting the grid
  useEffect(() => {
    simRef.current?.setRules(rules);
  }, [rules]);

  // Tick loop
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const sim = simRef.current;
      if (!sim) return;
      sim.step();

      // Update UI stats
      useUIStore.getState().setStats({
        generation: sim.generation,
        population: sim.population,
        birthsLastTick: sim.birthsLastTick,
        deathsLastTick: sim.deathsLastTick,
      });

      updateInstances();
    }, tickMs);
    return () => window.clearInterval(id);
  }, [running, tickMs, updateInstances]);

  const seedAtPoint = useCallback(
    (point: THREE.Vector3) => {
      const sim = simRef.current;
      if (!sim) return;

      const offsets = seedPattern === 'Random Disk' ? randomDiskOffsets() : currentPatternOffsets;

      if (debugLogs) {
        // eslint-disable-next-line no-console
        console.log(`[PlanetLife] seedAtPoint pattern=${seedPattern} offsets=${offsets.length}`);
      }

      sim.seedAtPoint({
        point,
        offsets,
        mode: seedMode,
        scale: seedScale,
        jitter: seedJitter,
        probability: seedProbability,
        debug: debugLogs,
      });
      updateInstances();

      // Visual ring
      const n = point.clone().normalize();
      setImpacts((list) => [
        ...list,
        {
          id: uid('impact'),
          point: point.clone(),
          normal: n,
          start: performance.now() / 1000,
          duration: impactRingDuration,
          color: impactRingColor,
          flashIntensity: impactFlashIntensity,
          flashRadius: impactFlashRadius,
          ringSize: impactRingSize,
        },
      ]);
    },
    [
      seedPattern,
      randomDiskOffsets,
      currentPatternOffsets,
      seedMode,
      seedScale,
      seedJitter,
      seedProbability,
      impactRingDuration,
      impactRingColor,
      impactFlashIntensity,
      impactFlashRadius,
      impactRingSize,
      updateInstances,
      debugLogs,
    ],
  );

  const onPlanetPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();

      const now = performance.now();
      if (now - lastShotMsRef.current < meteorCooldownMs) return;
      lastShotMsRef.current = now;

      const point = e.point.clone();
      const cam = e.camera;
      let origin: THREE.Vector3;
      if (cam && typeof cam === 'object' && 'position' in cam) {
        const camWithPosition = cam as { position: { clone: () => THREE.Vector3 } };
        origin = camWithPosition.position.clone();
      } else {
        origin = new THREE.Vector3(0, 0, 8);
      }

      const direction = point.clone().sub(origin).normalize();

      setMeteors((list) => [
        ...list,
        {
          id: uid('meteor'),
          origin,
          direction,
          speed: meteorSpeed,
          radius: meteorRadius,
          trailLength: meteorTrailLength,
          trailWidth: meteorTrailWidth,
          emissiveIntensity: meteorEmissive,
        },
      ]);
    },
    [
      meteorCooldownMs,
      meteorSpeed,
      meteorRadius,
      meteorTrailLength,
      meteorTrailWidth,
      meteorEmissive,
    ],
  );

  const onMeteorImpact = useCallback(
    (id: string, impactPoint: THREE.Vector3) => {
      if (debugLogs) {
        // eslint-disable-next-line no-console
        console.log(
          `[PlanetLife] onMeteorImpact id=${id} point=${impactPoint
            .toArray()
            .map((v) => v.toFixed(2))
            .join(',')}`,
        );
      }
      seedAtPoint(impactPoint);
      setMeteors((list) => list.filter((m) => m.id !== id));
    },
    [seedAtPoint, debugLogs],
  );

  // prune impact rings
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = performance.now() / 1000;
      setImpacts((list) => list.filter((i) => t - i.start < i.duration));
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <group>
      {/* Planet */}
      <mesh onPointerDown={onPlanetPointerDown}>
        <sphereGeometry args={[planetRadius, 64, 64]} />
        <primitive object={planetMaterial} attach="material" />
      </mesh>

      {/* Atmosphere glow */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[planetRadius * (1 + atmosphereHeight), 64, 64]} />
        <meshBasicMaterial
          color={atmosphereColor}
          transparent
          opacity={Math.max(0, atmosphereIntensity) * 0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Life overlay (equirectangular DataTexture mapped onto the sphere UVs) */}
      {(cellRenderMode === 'Texture' || cellRenderMode === 'Both') && (
        <mesh scale={1.01} raycast={() => null}>
          <sphereGeometry args={[planetRadius, 64, 64]} />
          <meshBasicMaterial
            map={lifeTex.tex}
            transparent
            opacity={cellOverlayOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Alive cells as an instanced mesh (only alive instances are rendered) */}
      {(cellRenderMode === 'Dots' || cellRenderMode === 'Both') && (
        <instancedMesh
          ref={cellsRef}
          args={[undefined, undefined, maxInstances]}
          frustumCulled={false}
        >
          <sphereGeometry args={[cellRadius, 10, 10]} />
          <meshStandardMaterial
            color={cellColor}
            emissive={cellColor}
            emissiveIntensity={0.7}
            roughness={0.35}
            metalness={0.05}
            vertexColors
          />
        </instancedMesh>
      )}

      {/* Meteors */}
      {meteors.map((m) => (
        <Meteor key={m.id} spec={m} planetRadius={planetRadius} onImpact={onMeteorImpact} />
      ))}

      {/* Impact rings */}
      {impacts.map((i) => (
        <ImpactRing key={i.id} spec={i} planetRadius={planetRadius} />
      ))}
    </group>
  );
}
