import type * as THREE from 'three';

import { offsetsToMatrix, transformOffsets } from '../../sim/patterns';
import type { GPUSimulationHandle } from '../GPUSimulation';
import type { SeedRequest } from './seedRequest';

export type SeedTarget = {
  point: THREE.Vector3;
  lat: number;
  lon: number;
  latCells: number;
  lonCells: number;
  /** GPU handle when the GPU sim is active and mounted; otherwise null. */
  gpu: GPUSimulationHandle | null;
  /** CPU/worker seeder, used when `gpu` is null. */
  cpu: (params: SeedRequest & { point: THREE.Vector3 }) => void;
};

/**
 * Apply a resolved seed to whichever sim is active. The GPU path converts the
 * lat/lon cell to UV and bakes the offsets into a pattern matrix once; the CPU
 * path forwards the request unchanged (it applies scale/jitter itself).
 */
export function applySeed(request: SeedRequest, target: SeedTarget): void {
  if (!target.gpu) {
    target.cpu({ ...request, point: target.point });
    return;
  }

  // Empty patterns have nothing to stamp on the GPU.
  if (request.offsets.length === 0) return;

  const v = (target.lat + 0.5) / target.latCells;
  const u = (target.lon + 0.5) / target.lonCells;
  const offsets = transformOffsets(request.offsets, request.scale, request.jitter);
  const { matrix, originRow, originCol } = offsetsToMatrix(offsets);

  target.gpu.seedAtUV({
    u,
    v,
    pattern: matrix,
    mode: request.mode,
    probability: request.probability,
    originRow,
    originCol,
  });
}
