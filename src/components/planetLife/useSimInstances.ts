import { useCallback, useRef } from 'react';
import * as THREE from 'three';

import type { LifeSphereSim } from '../../sim/LifeSphereSim';
import type { ResolveCellColor } from './cellColor';
import type { LifeTexture } from './lifeTexture';
import { writeLifeTexture } from './lifeTexture';

export interface UseSimInstancesOptions {
  workerEnabled: boolean;
  workerSnapshotRef: React.RefObject<{
    grid: Uint8Array;
    age: Uint8Array;
    heat: Uint8Array;
    aliveIndices: Int32Array;
    population: number;
    buffers: {
      grid: ArrayBuffer;
      age: ArrayBuffer;
      heat: ArrayBuffer;
      aliveIndices: ArrayBuffer;
    };
  } | null>;
  geometrySimRef: React.RefObject<LifeSphereSim | null>;
  simRef: React.RefObject<LifeSphereSim | null>;
  cellRenderMode: 'Texture' | 'Dots' | 'Both';
  cellsRef: React.RefObject<THREE.InstancedMesh | null>;
  lifeTex: LifeTexture;
  dummy: THREE.Object3D;
  colorScratch: THREE.Color;
  resolveCellColor: ResolveCellColor;
  gameMode: 'Classic' | 'Colony';
  debugLogs: boolean;
}

export function useSimInstances({
  workerEnabled,
  workerSnapshotRef,
  geometrySimRef,
  simRef,
  cellRenderMode,
  cellsRef,
  lifeTex,
  dummy,
  colorScratch,
  resolveCellColor,
  gameMode,
  debugLogs,
}: UseSimInstancesOptions) {
  const instancingConfiguredRef = useRef(false);

  const updateTexture = useCallback(() => {
    const snap = workerEnabled ? workerSnapshotRef.current : null;
    const sim = workerEnabled ? null : simRef.current;
    const grid = snap ? snap.grid : sim?.getGridView();
    const ages = snap ? snap.age : sim?.getAgeView();
    const heat = snap ? snap.heat : sim?.getNeighborHeatView();
    if (!grid || !ages || !heat) return;

    writeLifeTexture({
      grid,
      ages,
      heat,
      lifeTex,
      gameMode,
      debugLogs,
    });
  }, [lifeTex, gameMode, debugLogs, workerEnabled, workerSnapshotRef, simRef]);

  const updateInstances = useCallback(() => {
    const sim = workerEnabled ? geometrySimRef.current : simRef.current;
    if (!sim) return;

    const snap = workerEnabled ? workerSnapshotRef.current : null;
    const grid = workerEnabled ? snap?.grid : simRef.current?.getGridView();
    const ages = workerEnabled ? snap?.age : simRef.current?.getAgeView();
    const heat = workerEnabled ? snap?.heat : simRef.current?.getNeighborHeatView();
    if (!grid || !ages || !heat) return;

    const overlayEnabled = cellRenderMode === 'Texture' || cellRenderMode === 'Both';
    if (overlayEnabled) updateTexture();

    const mesh = cellsRef.current;
    if (!mesh) return;

    if (!instancingConfiguredRef.current) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (mesh.instanceColor) mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      instancingConfiguredRef.current = true;
    }

    let i = 0;

    if (workerEnabled && snap) {
      const positions = sim.positions;
      const alive = snap.aliveIndices;
      const count = snap.population;
      for (let j = 0; j < count; j++) {
        const idx = alive[j];
        dummy.position.copy(positions[idx]);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        resolveCellColor(idx, grid, ages, heat, colorScratch);
        mesh.setColorAt(i, colorScratch);
        i++;
      }
    } else if (!workerEnabled) {
      const currentGrid = sim.getGridView();
      sim.forEachAlive((idx) => {
        dummy.position.copy(sim.positions[idx]);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        resolveCellColor(idx, currentGrid, ages, heat, colorScratch);
        mesh.setColorAt(i, colorScratch);
        i++;
      });
    }

    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [
    cellRenderMode,
    cellsRef,
    colorScratch,
    dummy,
    geometrySimRef,
    resolveCellColor,
    simRef,
    updateTexture,
    workerEnabled,
    workerSnapshotRef,
  ]);

  return {
    updateInstances,
    updateTexture,
  };
}
