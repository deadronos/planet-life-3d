import { useCallback, useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { Rules } from '../../sim/LifeSphereSim';
import { LifeSphereSim } from '../../sim/LifeSphereSim';
import { useUIStore } from '../../store/useUIStore';
import type { ResolveCellColor } from './cellColor';
import { writeLifeTexture, type LifeTexture } from './lifeTexture';

export function usePlanetLifeSim({
  running,
  tickMs,
  safeLatCells,
  safeLonCells,
  planetRadius,
  cellLift,
  rules,
  randomDensity,
  lifeTex,
  dummy,
  cellsRef,
  resolveCellColor,
  colorScratch,
  debugLogs,
}: {
  running: boolean;
  tickMs: number;
  safeLatCells: number;
  safeLonCells: number;
  planetRadius: number;
  cellLift: number;
  rules: Rules;
  randomDensity: number;
  lifeTex: LifeTexture;
  dummy: THREE.Object3D;
  cellsRef: RefObject<THREE.InstancedMesh | null>;
  resolveCellColor: ResolveCellColor;
  colorScratch: THREE.Color;
  debugLogs: boolean;
}) {
  const simRef = useRef<LifeSphereSim | null>(null);

  const updateTexture = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;

    writeLifeTexture({
      grid: sim.getGridView(),
      ages: sim.getAgeView(),
      heat: sim.getNeighborHeatView(),
      lifeTex,
      resolveCellColor,
      colorScratch,
      debugLogs,
    });
  }, [lifeTex, resolveCellColor, colorScratch, debugLogs]);

  const updateInstances = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;

    // Keep the planet overlay in sync with the sim (works even in Texture-only mode).
    updateTexture();

    const mesh = cellsRef.current;
    if (!mesh) return;

    const ages = sim.getAgeView();
    const heat = sim.getNeighborHeatView();

    let i = 0;
    sim.forEachAlive((idx) => {
      dummy.position.copy(sim.positions[idx]);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      resolveCellColor(idx, ages, heat, colorScratch);
      mesh.setColorAt(i, colorScratch);
      i++;
    });

    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cellsRef, colorScratch, dummy, resolveCellColor, updateTexture]);

  const clear = useCallback(() => {
    simRef.current?.clear();
    updateInstances();
  }, [updateInstances]);

  const randomize = useCallback(() => {
    simRef.current?.randomize(randomDensity);
    updateInstances();
  }, [randomDensity, updateInstances]);

  const stepOnce = useCallback(() => {
    simRef.current?.step();
    updateInstances();
  }, [updateInstances]);

  // (Re)create sim when grid or planet sizing changes
  useEffect(() => {
    simRef.current = new LifeSphereSim({
      latCells: safeLatCells,
      lonCells: safeLonCells,
      planetRadius,
      cellLift,
      rules,
    });

    simRef.current.randomize(randomDensity);
    updateInstances();
  }, [safeLatCells, safeLonCells, planetRadius, cellLift, rules, randomDensity, updateInstances]);

  // Update rules without resetting the grid
  useEffect(() => {
    simRef.current?.setRules(rules);
  }, [rules]);

  // Tick loop
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const sim = simRef.current;
      if (!sim) return;
      sim.step();

      useUIStore.getState().setStats({
        generation: sim.generation,
        population: sim.population,
        birthsLastTick: sim.birthsLastTick,
        deathsLastTick: sim.deathsLastTick,
      });

      updateInstances();
    }, tickMs);

    return () => window.clearInterval(id);
  }, [running, tickMs, updateInstances]);

  return {
    simRef,
    updateInstances,
    clear,
    randomize,
    stepOnce,
  };
}
