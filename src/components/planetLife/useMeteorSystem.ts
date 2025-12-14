import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { MeteorSpec } from '../Meteor';
import type { ImpactSpec } from '../ImpactRing';
import { uid } from './utils';

type MeteorSystemParams = {
  meteorSpeed: number;
  meteorRadius: number;
  meteorCooldownMs: number;
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
