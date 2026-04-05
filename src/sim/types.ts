import type * as THREE from 'three';
import type { Offset } from './patterns';

export type GameMode = 'Classic' | 'Colony';

export type SeedMode = 'set' | 'toggle' | 'clear' | 'random';

export type SeedAtPointParams = {
  point: THREE.Vector3;
  offsets: Offset[];
  mode: SeedMode;
  scale: number;
  jitter: number;
  probability: number;
  rng?: () => number;
  debug?: boolean;
};
