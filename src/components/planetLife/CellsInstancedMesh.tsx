import type { RefObject } from 'react';
import * as THREE from 'three';

export interface CellsInstancedMeshProps {
  cellsRef: RefObject<THREE.InstancedMesh | null>;
  maxInstances: number;
  cellRadius: number;
  cellColor: string;
}

export function CellsInstancedMesh({
  cellsRef,
  maxInstances,
  cellRadius,
  cellColor,
}: CellsInstancedMeshProps) {
  return (
    <instancedMesh ref={cellsRef} args={[undefined, undefined, maxInstances]} frustumCulled={false}>
      <sphereGeometry args={[cellRadius, 10, 10]} />
      <meshStandardMaterial
        color={cellColor}
        emissive={cellColor}
        emissiveIntensity={0.7}
        roughness={0.35}
        metalness={0.05}
        vertexColors
      />
    </instancedMesh>
  );
}
