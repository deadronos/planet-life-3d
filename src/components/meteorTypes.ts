import * as THREE from 'three';

/** `user` = fired by a planet click; `shower` = spawned by the ambient meteor shower. */
export type MeteorSource = 'user' | 'shower';

export type MeteorSpec = {
  id: string;
  source: MeteorSource;
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
