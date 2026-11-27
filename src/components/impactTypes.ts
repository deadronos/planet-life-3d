import * as THREE from 'three';

import type { MeteorTool } from '../store/useUIStore';
import type { MeteorSource } from './meteorTypes';

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
  source?: MeteorSource;
  tool?: MeteorTool;
};

export function computeImpactBasis(normal: THREE.Vector3, planetRadius: number) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  const pos = normal.clone().multiplyScalar(planetRadius + 0.01);
  return { q, pos };
}
