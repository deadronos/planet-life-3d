import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { clamp01 } from '../sim/utils';
import { computeImpactBasis, type ImpactSpec } from './impactTypes';

export function ImpactRing(props: { spec: ImpactSpec; planetRadius: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.MeshBasicMaterial>(null!);
  const flashRef = useRef<THREE.Mesh>(null!);
  const flashMatRef = useRef<THREE.MeshBasicMaterial>(null!);

  const basis = useMemo(
    () => computeImpactBasis(props.spec.normal, props.planetRadius),
    [props.spec.normal, props.planetRadius],
  );

  useFrame(({ clock }) => {
    const t = (clock.getElapsedTime() - props.spec.start) / props.spec.duration;
    const u = clamp01(t);
    const scale = THREE.MathUtils.lerp(0.25 * props.spec.ringSize, 2.3 * props.spec.ringSize, u);

    groupRef.current.position.copy(basis.pos);
    groupRef.current.quaternion.copy(basis.q);
    meshRef.current.scale.setScalar(scale);
    matRef.current.opacity = 1 - u;

    flashRef.current.scale.setScalar(props.spec.flashRadius * (1 + u * 0.5));
    flashMatRef.current.opacity = (1 - u) * props.spec.flashIntensity;
  });

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef}>
        <ringGeometry args={[0.06, 0.12, 32]} />
        <meshBasicMaterial
          ref={matRef}
          color={props.spec.color}
          transparent
          opacity={1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={flashRef}>
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial
          ref={flashMatRef}
          color={props.spec.color}
          transparent
          opacity={props.spec.flashIntensity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
