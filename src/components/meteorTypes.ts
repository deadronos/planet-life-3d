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
