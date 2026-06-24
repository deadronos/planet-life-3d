import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { intersectPlanetShell, MAX_METEOR_DT_SECONDS } from './meteorCollision';
import { computeMeteorState, type MeteorSpec } from './meteorTypes';

export function Meteor(props: {
  spec: MeteorSpec;
  planetRadius: number;
  onImpact: (id: string, impactPoint: THREE.Vector3) => void;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const headMatRef = useRef<THREE.MeshStandardMaterial>(null!);
  const trailRef = useRef<THREE.Mesh>(null!);
  const impactedRef = useRef(false);
  const trailQuat = useMemo(() => new THREE.Quaternion(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  // Scratch vectors reused across frames to avoid per-tick allocations.
  const nextScratch = useMemo(() => new THREE.Vector3(), []);
  const impactScratch = useMemo(() => new THREE.Vector3(), []);

  const state = useMemo(
    () => computeMeteorState(props.spec.origin, props.spec.direction),
    [props.spec.origin, props.spec.direction],
  );

  useFrame((_, dt) => {
    if (impactedRef.current) return;

    // Clamp the frame delta so a long pause (tab inactive, GC stall, devtools
    // throttling) can't teleport the meteor past the planet in a single step.
    const stepDt = Math.min(Math.max(0, dt), MAX_METEOR_DT_SECONDS);
    nextScratch
      .copy(state.dir)
      .multiplyScalar(props.spec.speed * stepDt)
      .add(state.pos);
    const impact = intersectPlanetShell({
      prev: state.pos,
      next: nextScratch,
      planetRadius: props.planetRadius,
      meteorRadius: props.spec.radius,
      scratch: impactScratch,
    });
    state.pos.copy(nextScratch);

    trailQuat.setFromUnitVectors(up, state.dir);
    groupRef.current.position.copy(state.pos);
    groupRef.current.quaternion.copy(trailQuat);

    trailRef.current.position.set(0, -props.spec.trailLength * 0.5, 0);
    trailRef.current.scale.set(
      props.spec.trailWidth,
      props.spec.trailLength,
      props.spec.trailWidth,
    );
    headMatRef.current.emissiveIntensity = props.spec.emissiveIntensity;

    if (impact.hit) {
      impactedRef.current = true;
      // Use the pre-allocated scratch point copy so the impact callback
      // can keep a reference without us having to clone.
      const impactPoint = impact.point.clone();
      props.onImpact(props.spec.id, impactPoint);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[props.spec.radius, 16, 16]} />
        <meshStandardMaterial
          ref={headMatRef}
          color={'#ffd68a'}
          emissive={'#ffcc66'}
          emissiveIntensity={props.spec.emissiveIntensity}
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>
      <mesh ref={trailRef}>
        <coneGeometry args={[props.spec.trailWidth, 1, 14, 1, true]} />
        <meshBasicMaterial
          color={'#ffbb55'}
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
