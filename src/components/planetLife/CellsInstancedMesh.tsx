import { type RefObject, useCallback } from 'react';
import * as THREE from 'three';

export interface CellsInstancedMeshProps {
  cellsRef: RefObject<THREE.InstancedMesh | null>;
  maxInstances: number;
  cellRadius: number;
}

/**
 * Patches MeshStandardMaterial so `emissive` is modulated by per-instance
 * `vColor` (matching `diffuseColor`), avoiding uniform single-color glow in
 * Colony and Neighbor Heat modes.
 */
export function patchInstancedEmissiveShader(shader: { fragmentShader: string }) {
  shader.fragmentShader = shader.fragmentShader.replace(
    'vec3 totalEmissiveRadiance = emissive;',
    `vec3 totalEmissiveRadiance = emissive;
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
  totalEmissiveRadiance *= vColor.rgb;
#endif`,
  );
}

export function CellsInstancedMesh({
  cellsRef,
  maxInstances,
  cellRadius,
}: CellsInstancedMeshProps) {
  const handleBeforeCompile = useCallback((shader: THREE.WebGLProgramParametersWithUniforms) => {
    patchInstancedEmissiveShader(shader);
  }, []);

  return (
    <instancedMesh ref={cellsRef} args={[undefined, undefined, maxInstances]} frustumCulled={false}>
      <sphereGeometry args={[cellRadius, 10, 10]} />
      <meshStandardMaterial
        color="#ffffff"
        emissive="#ffffff"
        emissiveIntensity={0.7}
        roughness={0.35}
        metalness={0.05}
        onBeforeCompile={handleBeforeCompile}
        customProgramCacheKey={() => 'cells-instanced-emissive'}
      />
    </instancedMesh>
  );
}
