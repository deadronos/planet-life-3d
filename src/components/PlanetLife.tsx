import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { button, useControls } from 'leva';
import type { ThreeEvent } from '@react-three/fiber';
import { parseRuleDigits } from '../sim/LifeSphereSim';
import { getBuiltinPatternOffsets, parseAsciiPattern } from '../sim/patterns';
import { Meteor, type MeteorSpec } from './Meteor';
import { ImpactRing, type ImpactSpec } from './ImpactRing';
import { usePlanetLifeControls } from './planetLife/controls';
import { useCellColorResolver } from './planetLife/cellColor';
import { useLifeTexture } from './planetLife/lifeTexture';
import { usePlanetMaterial } from './planetLife/planetMaterial';
import { usePlanetLifeSim } from './planetLife/usePlanetLifeSim';
import { safeInt, uid } from './planetLife/utils';

export function PlanetLife() {
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const params = usePlanetLifeControls();

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

  const cellsRef = useRef<THREE.InstancedMesh | null>(null);
  const lastShotMsRef = useRef(0);

  const [meteors, setMeteors] = useState<MeteorSpec[]>([]);
  const [impacts, setImpacts] = useState<ImpactSpec[]>([]);

  const safeLatCells = useMemo(() => safeInt(latCells, 48, 8, 256), [latCells]);
  const safeLonCells = useMemo(() => safeInt(lonCells, 96, 8, 512), [lonCells]);
  const maxInstances = useMemo(() => safeLatCells * safeLonCells, [safeLatCells, safeLonCells]);

  const lifeTex = useLifeTexture({ lonCells: safeLonCells, latCells: safeLatCells });

  const { resolveCellColor, colorScratch } = useCellColorResolver({
    cellColorMode,
    cellColor,
    ageFadeHalfLife,
    heatLowColor,
    heatMidColor,
    heatHighColor,
  });

  const planetMaterial = usePlanetMaterial({
    atmosphereColor,
    rimIntensity,
    rimPower,
    terminatorSharpness,
    terminatorBoost,
    planetRoughness,
    planetWireframe,
  });

  const { simRef, updateInstances, clear, randomize, stepOnce } = usePlanetLifeSim({
    running,
    tickMs,
    safeLatCells,
    safeLonCells,
    planetRadius,
    cellLift,
    rules,
    randomDensity,
    lifeTex,
    dummy,
    cellsRef,
    resolveCellColor,
    colorScratch,
    debugLogs,
  });

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
      simRef,
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
