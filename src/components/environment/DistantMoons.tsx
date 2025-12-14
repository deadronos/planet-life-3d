import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface MoonConfig {
  distance: number;
  size: number;
  speed: number;
  color: string;
  emissive: string;
  initialAngle: number;
  tilt: number;
}

/**
 * Two distant moons slowly orbiting in the far background.
 */
export function DistantMoons() {
  const groupRef = useRef<THREE.Group>(null);
  const moon1Ref = useRef<THREE.Mesh>(null);
  const moon2Ref = useRef<THREE.Mesh>(null);

  const moons: MoonConfig[] = useMemo(
    () => [
      {
        distance: 55,
        size: 1.2,
        speed: 0.02,
        color: '#8892b0',
        emissive: '#4a5568',
        initialAngle: 0,
        tilt: 0.3,
      },
      {
        distance: 70,
        size: 0.8,
        speed: 0.015,
        color: '#a0aec0',
        emissive: '#2d3748',
        initialAngle: Math.PI,
        tilt: -0.2,
      },
    ],
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (moon1Ref.current) {
      const m = moons[0];
      const angle = m.initialAngle + t * m.speed;
      moon1Ref.current.position.x = Math.cos(angle) * m.distance;
      moon1Ref.current.position.z = Math.sin(angle) * m.distance;
      moon1Ref.current.position.y = Math.sin(angle * 0.5) * m.distance * m.tilt;
    }

    if (moon2Ref.current) {
      const m = moons[1];
      const angle = m.initialAngle + t * m.speed;
      moon2Ref.current.position.x = Math.cos(angle) * m.distance;
      moon2Ref.current.position.z = Math.sin(angle) * m.distance;
      moon2Ref.current.position.y = Math.sin(angle * 0.7) * m.distance * m.tilt;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Moon 1 - larger, closer */}
      <mesh ref={moon1Ref} position={[moons[0].distance, 0, 0]}>
        <sphereGeometry args={[moons[0].size, 32, 32]} />
        <meshStandardMaterial
          color={moons[0].color}
          emissive={moons[0].emissive}
          emissiveIntensity={0.3}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* Moon 2 - smaller, farther */}
      <mesh ref={moon2Ref} position={[-moons[1].distance, 0, 0]}>
        <sphereGeometry args={[moons[1].size, 24, 24]} />
        <meshStandardMaterial
          color={moons[1].color}
          emissive={moons[1].emissive}
          emissiveIntensity={0.2}
          roughness={0.9}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}
