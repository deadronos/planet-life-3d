import type { ThreeEvent } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import type { MeteorTool } from '../../store/useUIStore';
import type { ImpactSpec } from '../impactTypes';
import { getMeteorVisualStyle, type MeteorSource, type MeteorSpec } from '../meteorTypes';
import type { ImpactsSlice, MeteorsSlice } from './controls';
import { formatVector3, uid } from './utils';

type MeteorSystemParams = {
  meteors: MeteorsSlice;
  impacts: ImpactsSlice;
  seedAtPoint: (
    point: THREE.Vector3,
    options: { updateProbe: boolean; forceLifeSeed?: boolean },
  ) => void;
  activeTool?: MeteorTool;
  isProbeActive?: boolean;
  debugLogs: boolean;
};

export function useMeteorSystem({
  meteors: meteorControls,
  impacts: impactControls,
  seedAtPoint,
  activeTool,
  isProbeActive = false,
  debugLogs,
}: MeteorSystemParams) {
  const {
    meteorSpeed,
    meteorRadius,
    meteorCooldownMs,
    showerEnabled,
    showerInterval,
    meteorTrailLength,
    meteorTrailWidth,
    meteorEmissive,
  } = meteorControls;
  const {
    impactFlashIntensity,
    impactFlashRadius,
    impactRingColor,
    impactRingDuration,
    impactRingSize,
  } = impactControls;
  const lastShotMsRef = useRef(-Infinity);
  const meteorsRef = useRef<MeteorSpec[]>([]);
  const [meteors, setMeteors] = useState<MeteorSpec[]>([]);
  const [impacts, setImpacts] = useState<ImpactSpec[]>([]);

  const makeMeteorSpec = useCallback(
    (
      origin: THREE.Vector3,
      direction: THREE.Vector3,
      source: MeteorSource,
      tool?: MeteorTool,
    ): MeteorSpec => ({
      id: uid('meteor'),
      source,
      ...(source === 'user' && tool ? { tool } : {}),
      origin,
      direction,
      speed: meteorSpeed,
      radius: meteorRadius,
      trailLength: meteorTrailLength,
      trailWidth: meteorTrailWidth,
      emissiveIntensity: meteorEmissive,
    }),
    [meteorSpeed, meteorRadius, meteorTrailLength, meteorTrailWidth, meteorEmissive],
  );

  const addMeteor = useCallback(
    (origin: THREE.Vector3, direction: THREE.Vector3, source: MeteorSource, tool?: MeteorTool) => {
      const meteor = makeMeteorSpec(origin, direction, source, tool);
      meteorsRef.current = [...meteorsRef.current, meteor];
      setMeteors((list) => [...list, meteor]);
    },
    [makeMeteorSpec],
  );

  const createRandomMeteor = useCallback(
    (source: MeteorSource): MeteorSpec => {
      // Pick a random target on the unit sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const target = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);

      // Start from somewhere far out (e.g. radius 12)
      // We add some jitter to the origin so it's not always falling straight down
      const originDir = target
        .clone()
        .add(
          new THREE.Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5,
          ).multiplyScalar(1.5),
        )
        .normalize();

      const origin = originDir.multiplyScalar(12);
      const direction = target.sub(origin).normalize();

      return makeMeteorSpec(origin, direction, source);
    },
    [makeMeteorSpec],
  );

  const spawnMeteorBurst = useCallback(
    (count = 4, source: MeteorSource = 'reseed') => {
      const safeCount = Math.max(1, Math.floor(count));
      const burst = Array.from({ length: safeCount }, () => createRandomMeteor(source));
      setMeteors((list) => [...list, ...burst]);
    },
    [createRandomMeteor],
  );

  // Meteor shower logic
  useEffect(() => {
    if (!showerEnabled) return;

    const id = window.setInterval(() => {
      setMeteors((list) => [...list, createRandomMeteor('shower')]);
    }, showerInterval);
    return () => window.clearInterval(id);
  }, [showerEnabled, showerInterval, createRandomMeteor]);

  const onPlanetPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();

      if (isProbeActive || activeTool === 'Probe') {
        seedAtPoint(e.point.clone(), { updateProbe: true });
        return;
      }

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

      addMeteor(origin, direction, 'user', activeTool);
    },
    [activeTool, isProbeActive, meteorCooldownMs, addMeteor, seedAtPoint],
  );

  const onMeteorImpact = useCallback(
    (id: string, impactPoint: THREE.Vector3, source: MeteorSource, tool?: MeteorTool) => {
      if (debugLogs) {
        // eslint-disable-next-line no-console
        console.log(`[PlanetLife] onMeteorImpact id=${id} point=${formatVector3(impactPoint)}`);
      }

      const resolvedTool =
        source === 'user'
          ? (tool ?? meteorsRef.current.find((m) => m.id === id)?.tool ?? activeTool)
          : undefined;
      const visualStyle = getMeteorVisualStyle(source, resolvedTool, impactRingColor);

      // Shower/reseed impacts still seed, but must not move the probe card.
      seedAtPoint(
        impactPoint,
        source === 'reseed'
          ? { updateProbe: false, forceLifeSeed: true }
          : { updateProbe: source === 'user' },
      );
      meteorsRef.current = meteorsRef.current.filter((m) => m.id !== id);
      setMeteors((list) => list.filter((m) => m.id !== id));

      // Visual ring
      const n = impactPoint.clone().normalize();
      setImpacts((list) => [
        ...list,
        {
          id: uid('impact'),
          point: impactPoint.clone(),
          normal: n,
          start: performance.now() / 1000,
          duration: impactRingDuration,
          color: visualStyle.impactRingColor,
          flashIntensity: impactFlashIntensity,
          flashRadius: impactFlashRadius,
          ringSize: impactRingSize,
          source,
          ...(resolvedTool ? { tool: resolvedTool } : {}),
        },
      ]);
    },
    [
      activeTool,
      seedAtPoint,
      debugLogs,
      impactRingDuration,
      impactRingColor,
      impactFlashIntensity,
      impactFlashRadius,
      impactRingSize,
    ],
  );

  // Prune expired impact rings. Earlier this used a 200ms setInterval
  // that woke React five times a second forever — even when no impacts
  // were on screen — purely to filter an empty list. Schedule a single
  // timeout for the next impact's expiry instead, and reschedule on
  // each new impact. Zero work when the impact list is empty.
  useEffect(() => {
    if (impacts.length === 0) return;
    const nowSec = performance.now() / 1000;
    let nextExpirySec = Infinity;
    for (const i of impacts) {
      const expiry = i.start + i.duration;
      if (expiry < nextExpirySec) nextExpirySec = expiry;
    }
    const delayMs = Math.max(0, (nextExpirySec - nowSec) * 1000) + 50; // 50ms buffer
    const id = window.setTimeout(() => {
      const t = performance.now() / 1000;
      setImpacts((list) => list.filter((i) => t - i.start < i.duration));
    }, delayMs);
    return () => window.clearTimeout(id);
  }, [impacts]);

  return {
    meteors,
    impacts,
    onPlanetPointerDown,
    onMeteorImpact,
    spawnMeteorBurst,
  };
}
