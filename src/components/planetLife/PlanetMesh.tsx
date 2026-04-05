import type { ThreeEvent } from '@react-three/fiber';
import type { Material } from 'three';

export interface PlanetMeshProps {
  planetRadius: number;
  material: Material;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
}

export function PlanetMesh({ planetRadius, material, onPointerDown }: PlanetMeshProps) {
  return (
    <mesh onPointerDown={onPointerDown}>
      <sphereGeometry args={[planetRadius, 64, 64]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
