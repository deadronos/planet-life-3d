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
  cellRenderMode: 'Texture' | 'Dots' | 'Both';
  cellOverlayOpacity: number;
  cellRadius: number;
  cellLift: number;
  cellColor: string;
  meteorSpeed: number;
  meteorRadius: number;
  meteorCooldownMs: number;
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
          value: 'Both' as const,
          options: ['Texture', 'Dots', 'Both'] as const,
        },
        cellOverlayOpacity: { value: 1, min: 0, max: 2, step: 0.01 },
        cellRadius: { value: 0.05, min: 0.01, max: 0.15, step: 0.005 },
        cellLift: { value: 0.04, min: 0, max: 0.25, step: 0.005 },
        cellColor: '#3dd54c',
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
  }) as unknown as PlanetLifeControls;

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

    cellRenderMode,
    cellOverlayOpacity,

    cellRadius,
    cellLift,
    cellColor,

    meteorSpeed,
    meteorRadius,
    meteorCooldownMs,

    seedMode,
    seedPattern,
    seedScale,
    seedJitter,
    seedProbability,
    customPattern,
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

  const cellRgb8 = useMemo(() => {
    const c = new THREE.Color(cellColor);
    return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)] as const;
  }, [cellColor]);

  const updateTexture = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;

    const grid = sim.getGridView();
    const { data, tex, w, h } = lifeTex;
    const [r, g, b] = cellRgb8;

    let aliveCount = 0;
    // Map sim lat index 0 (south pole) to texture v=0 (bottom).
    // DataTexture (flipY=false) maps row 0 to V=0.
    for (let la = 0; la < h; la++) {
      const srcRow = la * w;
      const dstRow = la * w;
      for (let lo = 0; lo < w; lo++) {
        const alive = grid[srcRow + lo] === 1;
        // Three.js SphereGeometry UVs run opposite to our generic Lon mapping.
        // Our Sim: u=0.25 -> -90 deg. Three.js u=0.25 -> +90 deg.
        // So we map Sim column `lo` to Texture column `w - 1 - lo`.
        const dstLo = w - 1 - lo;
        const di = (dstRow + dstLo) * 4;
        if (alive) {
          aliveCount++;
          data[di + 0] = r;
          data[di + 1] = g;
          data[di + 2] = b;
          data[di + 3] = 255;
        } else {
          data[di + 3] = 0;
        }
      }
    }

    if (aliveCount > 0 && Math.random() < 0.01) {
      // eslint-disable-next-line no-console
      console.log(`[PlanetLife] updateTexture: alive=${aliveCount}`);
    }

    tex.needsUpdate = true;
  }, [lifeTex, cellRgb8]);

  const debugTexture = useCallback(() => {
    const { data, tex, w, h } = lifeTex;
    // Draw cross
    for (let la = 0; la < h; la++) {
      for (let lo = 0; lo < w; lo++) {
        const di = (la * w + lo) * 4;
        // Equator (la ~ h/2) or Meridian (lo ~ w/2)
        if (Math.abs(la - h / 2) < 2 || Math.abs(lo - w / 2) < 2) {
          data[di + 0] = 255; // R
          data[di + 1] = 0; // G
          data[di + 2] = 255; // B
          data[di + 3] = 255; // A
        }
      }
    }
    tex.needsUpdate = true;
    console.log('[PlanetLife] Debug pattern drawn on texture');
  }, [lifeTex]);

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

    let i = 0;
    sim.forEachAlive((idx) => {
      dummy.position.copy(sim.positions[idx]);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      i++;
    });
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
  }, [dummy, updateTexture]);

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
      DebugTexture: button(() => debugTexture()),
    }),
    [randomize, clear, stepOnce, debugTexture],
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
      updateInstances();
    }, tickMs);
    return () => window.clearInterval(id);
  }, [running, tickMs, updateInstances]);

  const seedAtPoint = useCallback(
    (point: THREE.Vector3) => {
      const sim = simRef.current;
      if (!sim) return;

      const offsets = seedPattern === 'Random Disk' ? randomDiskOffsets() : currentPatternOffsets;

      // eslint-disable-next-line no-console
      console.log(`[PlanetLife] seedAtPoint pattern=${seedPattern} offsets=${offsets.length}`);

      sim.seedAtPoint({
        point,
        offsets,
        mode: seedMode,
        scale: seedScale,
        jitter: seedJitter,
        probability: seedProbability,
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
          duration: 0.55,
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
      updateInstances,
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
        },
      ]);
    },
    [meteorCooldownMs, meteorSpeed, meteorRadius],
  );

  const onMeteorImpact = useCallback(
    (id: string, impactPoint: THREE.Vector3) => {
      // eslint-disable-next-line no-console
      console.log(
        `[PlanetLife] onMeteorImpact id=${id} point=${impactPoint
          .toArray()
          .map((v) => v.toFixed(2))
          .join(',')}`,
      );
      seedAtPoint(impactPoint);
      setMeteors((list) => list.filter((m) => m.id !== id));
    },
    [seedAtPoint],
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
        <meshStandardMaterial
          color={'#1a1f2a'}
          roughness={planetRoughness}
          metalness={0.05}
          wireframe={planetWireframe}
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
            emissiveIntensity={0.6}
            roughness={0.35}
            metalness={0.05}
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
