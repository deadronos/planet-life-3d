import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { GPUSimulationHandle } from '../../src/components/GPUSimulation';
import { applySeed } from '../../src/components/planetLife/applySeed';
import type { SeedRequest } from '../../src/components/planetLife/seedRequest';
import { offsetsToMatrix, transformOffsets } from '../../src/sim/patterns';

const request: SeedRequest = {
  offsets: [
    [0, 0],
    [0, 1],
  ],
  mode: 'set',
  scale: 2,
  jitter: 0,
  probability: 0.4,
};

const point = new THREE.Vector3(1, 0, 0);

function makeGpu() {
  const seedAtUV = vi.fn<GPUSimulationHandle['seedAtUV']>();
  return { handle: { seedAtUV } as unknown as GPUSimulationHandle, seedAtUV };
}

describe('applySeed', () => {
  it('forwards the request to the CPU seeder when there is no GPU handle', () => {
    const cpu = vi.fn();
    applySeed(request, { point, lat: 1, lon: 2, latCells: 8, lonCells: 16, gpu: null, cpu });

    expect(cpu).toHaveBeenCalledWith({ ...request, point });
  });

  it('converts the cell to UV and stamps the transformed pattern on the GPU', () => {
    const { handle, seedAtUV } = makeGpu();
    const cpu = vi.fn();
    applySeed(request, { point, lat: 1, lon: 2, latCells: 8, lonCells: 16, gpu: handle, cpu });

    expect(cpu).not.toHaveBeenCalled();
    const offsets = transformOffsets(request.offsets, request.scale, request.jitter);
    const { matrix, originRow, originCol } = offsetsToMatrix(offsets);
    expect(seedAtUV).toHaveBeenCalledWith({
      u: (2 + 0.5) / 16,
      v: (1 + 0.5) / 8,
      pattern: matrix,
      mode: 'set',
      probability: 0.4,
      originRow,
      originCol,
    });
  });

  it('does not touch the GPU for an empty pattern', () => {
    const { handle, seedAtUV } = makeGpu();
    applySeed(
      { ...request, offsets: [] },
      { point, lat: 0, lon: 0, latCells: 4, lonCells: 4, gpu: handle, cpu: vi.fn() },
    );
    expect(seedAtUV).not.toHaveBeenCalled();
  });

  it('applies scale 1 on the GPU for disks so the radius is not scaled twice', () => {
    const { handle, seedAtUV } = makeGpu();
    const disk = { ...request, scale: 1 };
    applySeed(disk, { point, lat: 0, lon: 0, latCells: 4, lonCells: 4, gpu: handle, cpu: vi.fn() });

    const { matrix } = offsetsToMatrix(transformOffsets(disk.offsets, 1, 0));
    expect(seedAtUV.mock.calls[0][0].pattern).toEqual(matrix);
  });
});
