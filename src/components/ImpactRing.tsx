import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

export type ImpactSpec = {
  id: string;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  start: number;
  duration: number;
  color: string;
  flashIntensity: number;
  flashRadius: number;
  ringSize: number;
};

export function ImpactRing(props: { spec: ImpactSpec; planetRadius: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.MeshBasicMaterial>(null!);
  const flashRef = useRef<THREE.Mesh>(null!);
  const flashMatRef = useRef<THREE.MeshBasicMaterial>(null!);

  const basis = useMemo(() => {
    // ringGeometry faces +Z; rotate it so +Z aligns with the surface normal
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      props.spec.normal,
    );
    const pos = props.spec.normal.clone().multiplyScalar(props.planetRadius + 0.01);
    return { q, pos };
  }, [props.spec.normal, props.planetRadius]);

  useFrame(({ clock }) => {
    const t = (clock.getElapsedTime() - props.spec.start) / props.spec.duration;
    const u = Math.min(1, Math.max(0, t));
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
