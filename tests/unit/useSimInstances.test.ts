import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { isIdentityBasis, readTranslation } from '../../src/components/planetLife/instanceMatrix';
import type { LifeTexture } from '../../src/components/planetLife/lifeTexture';
import { useSimInstances } from '../../src/components/planetLife/useSimInstances';
import { LifeSphereSim } from '../../src/sim/LifeSphereSim';

const LAT = 8; // SIM_CONSTRAINTS clamps latCells to a minimum of 8
const LON = 8;
const RADIUS = 2.6;
const RULES = { birth: new Array(9).fill(false), survive: new Array(9).fill(false) };

function makeLifeTex(): LifeTexture {
  const data = new Uint8Array(LON * LAT * 4);
  const tex = new THREE.DataTexture(data, LON, LAT, THREE.RGBAFormat);
  return { data, tex, w: LON, h: LAT };
}

// The sim keeps a separate alive-index list that forEachAlive walks, so the
// board is populated through randomize() rather than by writing the grid
// directly - writing the grid alone would leave that index list stale.
function makeSim(density: number): LifeSphereSim {
  const sim = new LifeSphereSim({
    latCells: LAT,
    lonCells: LON,
    planetRadius: RADIUS,
    cellLift: 0,
    rules: RULES,
  });
  sim.randomize(density);
  return sim;
}

function makeMesh(): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.05, 4, 4),
    new THREE.MeshBasicMaterial(),
    LON * LAT,
  );
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(LON * LAT * 3), 3);
  return mesh;
}

function run(density: number) {
  const sim = makeSim(density);
  const mesh = makeMesh();
  const { result } = renderHook(() =>
    useSimInstances({
      workerEnabled: false,
      workerSnapshotRef: { current: null },
      geometrySimRef: { current: null },
      simRef: { current: sim },
      cellRenderMode: 'Dots',
      cellsRef: { current: mesh },
      lifeTex: makeLifeTex(),
      colorScratch: new THREE.Color(),
      resolveCellColor: () => 1,
      gameMode: 'Classic',
      debugLogs: false,
    }),
  );
  result.current.updateInstances();
  return { sim, mesh, arr: mesh.instanceMatrix.array as Float32Array };
}

describe('useSimInstances', () => {
  it('writes one instance per alive cell', () => {
    const { sim, mesh } = run(0.4);
    expect(mesh.count).toBe(sim.getAliveCount());
  });

  it('leaves every written slot at identity rotation and scale', () => {
    const { mesh, arr } = run(0.4);
    expect(mesh.count).toBeGreaterThan(0);
    for (let i = 0; i < mesh.count; i++) {
      expect(isIdentityBasis(arr, i)).toBe(true);
    }
  });

  it('writes each alive cell at its precomputed surface position', () => {
    const { sim, mesh, arr } = run(0.4);
    const alive = sim.getAliveIndicesView();
    const expected = new Set<string>();
    for (let i = 0; i < sim.getAliveCount(); i++) {
      const v = sim.positions[alive[i]];
      expected.add(`${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`);
    }
    for (let i = 0; i < mesh.count; i++) {
      const { x, y, z } = readTranslation(arr, i);
      expect(expected.has(`${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`)).toBe(true);
    }
  });

  it('keeps every written cell on the planet surface', () => {
    const { mesh, arr } = run(0.5);
    for (let i = 0; i < mesh.count; i++) {
      const { x, y, z } = readTranslation(arr, i);
      expect(Math.hypot(x, y, z)).toBeCloseTo(RADIUS, 4);
    }
  });

  it('reports zero instances for a dead board', () => {
    const { mesh } = run(0);
    expect(mesh.count).toBe(0);
  });

  it('marks both instance buffers for upload', () => {
    const { mesh } = run(0.4);
    expect(mesh.instanceMatrix.version).toBeGreaterThan(0);
    expect(mesh.instanceColor?.version).toBeGreaterThan(0);
  });

  it('handles a fully populated board', () => {
    const { sim, mesh } = run(1);
    expect(mesh.count).toBe(LAT * LON);
    expect(mesh.count).toBe(sim.getAliveCount());
  });
});
