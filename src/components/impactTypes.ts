import * as THREE from 'three';

export type ImpactSpec = {
  id: string;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  start: number;
  duration: number;
  color: THREE.ColorRepresentation;
  flashIntensity: number;
  flashRadius: number;
  ringSize: number;
};

export function computeImpactBasis(normal: THREE.Vector3, planetRadius: number) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  const pos = normal.clone().multiplyScalar(planetRadius + 0.01);
  return { q, pos };
}
