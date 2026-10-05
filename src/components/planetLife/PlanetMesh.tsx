import type { ThreeEvent } from '@react-three/fiber';
import type { Material } from 'three';

import { PLANET_SPHERE_SEGMENTS } from './Atmosphere';

export interface PlanetMeshProps {
  planetRadius: number;
  material: Material;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
}

export function PlanetMesh({ planetRadius, material, onPointerDown }: PlanetMeshProps) {
  return (
    <mesh onPointerDown={onPointerDown}>
      <sphereGeometry args={[planetRadius, PLANET_SPHERE_SEGMENTS, PLANET_SPHERE_SEGMENTS]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
