import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

export type MeteorSpec = {
  id: string;
  origin: THREE.Vector3;
  direction: THREE.Vector3; // normalized
  speed: number;
  radius: number;
  trailLength: number;
  trailWidth: number;
  emissiveIntensity: number;
};

export function computeMeteorState(origin: THREE.Vector3, direction: THREE.Vector3) {
  return {
    pos: origin.clone(),
    dir: direction.clone().normalize(),
  };
}

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

  const state = useMemo(
    () => computeMeteorState(props.spec.origin, props.spec.direction),
    [props.spec.origin, props.spec.direction],
  );

  useFrame((_, dt) => {
    if (impactedRef.current) return;
    state.pos.addScaledVector(state.dir, props.spec.speed * dt);

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

    // impact when meteor reaches the planet surface (simple sphere collision)
    const r = props.planetRadius + props.spec.radius;
    if (state.pos.lengthSq() <= r * r) {
      impactedRef.current = true;
      const impact = state.pos.clone().normalize().multiplyScalar(props.planetRadius);
      props.onImpact(props.spec.id, impact);
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
