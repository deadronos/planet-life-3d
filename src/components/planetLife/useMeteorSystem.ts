import type { ThreeEvent } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import type { ImpactSpec } from '../impactTypes';
import type { MeteorSpec } from '../meteorTypes';
import { formatVector3, uid } from './utils';

type MeteorSystemParams = {
  meteorSpeed: number;
  meteorRadius: number;
  meteorCooldownMs: number;
  showerEnabled: boolean;
  showerInterval: number;
  meteorTrailLength: number;
  meteorTrailWidth: number;
  meteorEmissive: number;
  impactFlashIntensity: number;
  impactFlashRadius: number;
  impactRingColor: THREE.ColorRepresentation;
  impactRingDuration: number;
  impactRingSize: number;
  seedAtPoint: (point: THREE.Vector3) => void;
  debugLogs: boolean;
};

export function useMeteorSystem({
  meteorSpeed,
  meteorRadius,
  meteorCooldownMs,
  showerEnabled,
  showerInterval,
  meteorTrailLength,
  meteorTrailWidth,
  meteorEmissive,
  impactFlashIntensity,
  impactFlashRadius,
  impactRingColor,
  impactRingDuration,
  impactRingSize,
  seedAtPoint,
  debugLogs,
}: MeteorSystemParams) {
  const lastShotMsRef = useRef(0);
  const [meteors, setMeteors] = useState<MeteorSpec[]>([]);
  const [impacts, setImpacts] = useState<ImpactSpec[]>([]);

  // Meteor shower logic
  useEffect(() => {
    if (!showerEnabled) return;

    const spawnMeteor = () => {
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
    };

    const id = window.setInterval(spawnMeteor, showerInterval);
    return () => window.clearInterval(id);
  }, [
    showerEnabled,
    showerInterval,
    meteorSpeed,
    meteorRadius,
    meteorTrailLength,
    meteorTrailWidth,
    meteorEmissive,
  ]);

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
        console.log(`[PlanetLife] onMeteorImpact id=${id} point=${formatVector3(impactPoint)}`);
      }

      seedAtPoint(impactPoint);
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
          color: impactRingColor,
          flashIntensity: impactFlashIntensity,
          flashRadius: impactFlashRadius,
          ringSize: impactRingSize,
        },
      ]);
    },
    [
      seedAtPoint,
      debugLogs,
      impactRingDuration,
      impactRingColor,
      impactFlashIntensity,
      impactFlashRadius,
      impactRingSize,
    ],
  );

  // prune impact rings
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = performance.now() / 1000;
      setImpacts((list) => list.filter((i) => t - i.start < i.duration));
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  return {
    meteors,
    impacts,
    onPlanetPointerDown,
    onMeteorImpact,
  };
}
