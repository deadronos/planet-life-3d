import { type RefObject, useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';

import type { EcologyProfileName } from '../../sim/ecology';
import { LifeSphereSim } from '../../sim/LifeSphereSim';
import type { Offset } from '../../sim/patterns';
import type { Rules } from '../../sim/rules';
import { spherePointToCell } from '../../sim/spherePointToCell';
import type { SeedMode } from '../../sim/types';
import { useUIStore } from '../../store/useUIStore';
import type { LifeGridWorkerInMessage } from '../../workers/lifeGridWorkerMessages';
import type { ResolveCellColor } from './cellColor';
import { type LifeTexture } from './lifeTexture';
import { useSimInstances } from './useSimInstances';
import { useSimTickLoop } from './useSimTickLoop';
import { useSimWorker } from './useSimWorker';

export function usePlanetLifeSim({
  running,
  tickMs,
  safeLatCells,
  safeLonCells,
  planetRadius,
  cellLift,
  cellRenderMode,
  gameMode,
  rules,
  ecologyProfile,
  randomDensity,
  workerSim,
  gpuSim = false,
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
  cellRenderMode: 'Texture' | 'Dots' | 'Both';
  gameMode: 'Classic' | 'Colony';
  rules: Rules;
  ecologyProfile: EcologyProfileName;
  randomDensity: number;
  workerSim: boolean;
  gpuSim?: boolean;
  lifeTex: LifeTexture;
  dummy: THREE.Object3D;
  cellsRef: RefObject<THREE.InstancedMesh | null>;
  resolveCellColor: ResolveCellColor;
  colorScratch: THREE.Color;
  debugLogs: boolean;
}) {
  const simRef = useRef<LifeSphereSim | null>(null);
  const geometrySimRef = useRef<LifeSphereSim | null>(null);
  const updateInstancesRef = useRef<() => void>(() => {
    /* noop */
  });

  const workerEnabled = workerSim && typeof Worker !== 'undefined';

  const publishStats = useCallback(
    (source: {
      generation: number;
      population: number;
      birthsLastTick: number;
      deathsLastTick: number;
    }) => {
      useUIStore.getState().setStats({
        generation: source.generation,
        population: source.population,
        birthsLastTick: source.birthsLastTick,
        deathsLastTick: source.deathsLastTick,
      });
    },
    [],
  );

  const onSnapshot = useCallback(
    (msg: {
      generation: number;
      population: number;
      birthsLastTick: number;
      deathsLastTick: number;
    }) => {
      // In GPU mode the authoritative simulation is the GPU sim; the
      // CPU/worker sim only exists as a texture fallback, so its stats must
      // not drive the HUD.
      if (!gpuSim) publishStats(msg);
      updateInstancesRef.current();
    },
    [gpuSim, publishStats],
  );

  const {
    workerRef,
    workerTickInFlightRef,
    workerSnapshotRef,
    postMessage: workerPostMessage,
  } = useSimWorker({
    workerEnabled,
    safeLatCells,
    safeLonCells,
    rules,
    ecologyProfile,
    randomDensity,
    gameMode,
    debugLogs,
    onSnapshot,
  });

  const { updateInstances, updateTexture } = useSimInstances({
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
  });

  useEffect(() => {
    updateInstancesRef.current = updateInstances;
  }, [updateInstances]);

  useEffect(() => {
    if (cellRenderMode === 'Texture' || cellRenderMode === 'Both') updateTexture();
  }, [cellRenderMode, updateTexture]);

  const clear = useCallback(() => {
    if (workerEnabled && workerRef.current) {
      workerPostMessage({ type: 'clear' } satisfies LifeGridWorkerInMessage);
      return;
    }
    const sim = simRef.current;
    sim?.clear();
    if (!gpuSim && sim) publishStats(sim);
    updateInstances();
  }, [gpuSim, publishStats, updateInstances, workerEnabled, workerRef, workerPostMessage]);

  const randomize = useCallback(() => {
    if (workerEnabled && workerRef.current) {
      workerPostMessage({
        type: 'randomize',
        density: randomDensity,
      } satisfies LifeGridWorkerInMessage);
      return;
    }
    const sim = simRef.current;
    sim?.randomize(randomDensity);
    if (!gpuSim && sim) publishStats(sim);
    updateInstances();
  }, [
    gpuSim,
    publishStats,
    randomDensity,
    updateInstances,
    workerEnabled,
    workerRef,
    workerPostMessage,
  ]);

  const stepOnce = useCallback(() => {
    if (workerEnabled && workerRef.current) {
      if (workerTickInFlightRef.current) return;
      workerTickInFlightRef.current = true;
      workerPostMessage({ type: 'tick', steps: 1 } satisfies LifeGridWorkerInMessage);
      return;
    }
    const sim = simRef.current;
    sim?.step();
    if (!gpuSim && sim) publishStats(sim);
    updateInstances();
  }, [
    gpuSim,
    publishStats,
    updateInstances,
    workerEnabled,
    workerRef,
    workerTickInFlightRef,
    workerPostMessage,
  ]);

  const seedAtPoint = useCallback(
    (params: {
      point: THREE.Vector3;
      offsets: Offset[];
      mode: SeedMode;
      scale: number;
      jitter: number;
      probability: number;
      debug?: boolean;
    }) => {
      if (workerEnabled && workerRef.current) {
        const { lat, lon } = spherePointToCell(params.point, safeLatCells, safeLonCells);
        workerPostMessage({
          type: 'seedAtCell',
          lat,
          lon,
          offsets: params.offsets,
          mode: params.mode,
          scale: params.scale,
          jitter: params.jitter,
          probability: params.probability,
          debug: params.debug,
        } satisfies LifeGridWorkerInMessage);
        return;
      }

      const sim = simRef.current;
      sim?.seedAtPoint({
        point: params.point,
        offsets: params.offsets,
        mode: params.mode,
        scale: params.scale,
        jitter: params.jitter,
        probability: params.probability,
        debug: params.debug,
      });
      // Keep the HUD population current after a manual seed. The worker
      // path publishes via the snapshot; the CPU path needs it here.
      if (!gpuSim && sim) publishStats(sim);
      updateInstances();
    },
    [
      gpuSim,
      publishStats,
      updateInstances,
      workerEnabled,
      workerRef,
      workerPostMessage,
      safeLatCells,
      safeLonCells,
    ],
  );

  // Mirror the latest randomDensity in a ref so the sim-creation effect
  // below can read the current value without listing it as a dep (which
  // would re-randomize the grid on every slider move).
  const randomDensityRef = useRef(randomDensity);
  useEffect(() => {
    randomDensityRef.current = randomDensity;
  }, [randomDensity]);

  // Sim lifecycle: only re-create the sim when the grid resolution changes
  // or when worker mode toggles. Per-setting
  // changes (rules, gameMode, ecologyProfile) are applied in place by the
  // three per-setting effects below, and the randomDensity slider no
  // longer wipes the world — it's only sampled when the user explicitly
  // clicks the Randomize action. Planet radius / cell lift are handled by a
  // separate geometry-only effect below so they don't wipe the world either.
  useEffect(() => {
    if (workerEnabled) {
      // In worker mode we still keep a geometry-only sim around for the
      // instanced-mesh dots path, but the authoritative state lives in
      // the worker. Per-setting updates are posted by the per-setting
      // effects below.
      geometrySimRef.current = new LifeSphereSim({
        latCells: safeLatCells,
        lonCells: safeLonCells,
        planetRadius,
        cellLift,
        rules,
      });
      geometrySimRef.current.setGameMode(gameMode);
      geometrySimRef.current.setEcologyProfile(ecologyProfile);
      simRef.current = null;
      updateInstancesRef.current();
      return;
    }

    const sim = new LifeSphereSim({
      latCells: safeLatCells,
      lonCells: safeLonCells,
      planetRadius,
      cellLift,
      rules,
    });
    sim.setGameMode(gameMode);
    sim.setEcologyProfile(ecologyProfile);

    simRef.current = sim;
    geometrySimRef.current = sim;

    sim.randomize(randomDensityRef.current);
    updateInstancesRef.current();
    // Intentionally omit `rules`, `ecologyProfile`, `randomDensity`, and
    // `gameMode` from the dep list. rules/gameMode/ecologyProfile are
    // pushed to the sim in place by the per-setting effects below;
    // randomDensity is sampled on demand from randomDensityRef when the
    // user clicks Randomize. Listing them here would recreate the sim
    // (and re-randomize) on every Leva change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeLatCells, safeLonCells, workerEnabled]);

  // Geometry-only updates (planetRadius / cellLift) recompute surface
  // positions in place instead of recreating the sim — recreating would
  // re-randomize the world every time the user drags one of these sliders.
  useEffect(() => {
    simRef.current?.updateSurfaceGeometry(planetRadius, cellLift);
    geometrySimRef.current?.updateSurfaceGeometry(planetRadius, cellLift);
    updateInstancesRef.current();
  }, [planetRadius, cellLift]);

  useEffect(() => {
    if (workerEnabled && workerRef.current) {
      workerPostMessage({ type: 'setRules', rules } satisfies LifeGridWorkerInMessage);
      return;
    }
    simRef.current?.setRules(rules);
  }, [rules, workerEnabled, workerRef, workerPostMessage]);

  useEffect(() => {
    if (workerEnabled && workerRef.current) {
      workerPostMessage({
        type: 'setGameMode',
        mode: gameMode,
      } satisfies LifeGridWorkerInMessage);
      return;
    }
    simRef.current?.setGameMode(gameMode);
  }, [gameMode, workerEnabled, workerRef, workerPostMessage]);

  useEffect(() => {
    if (workerEnabled && workerRef.current) {
      workerPostMessage({
        type: 'setEcologyProfile',
        profile: ecologyProfile,
      } satisfies LifeGridWorkerInMessage);
      return;
    }
    simRef.current?.setEcologyProfile(ecologyProfile);
  }, [ecologyProfile, workerEnabled, workerRef, workerPostMessage]);

  useSimTickLoop({
    // The CPU/worker sim is paused while the GPU sim is authoritative. It
    // remains initialized purely as a texture fallback if the GPU path
    // fails, and its stats are never published in GPU mode.
    running: running && !gpuSim,
    tickMs,
    workerEnabled,
    workerRef,
    workerTickInFlightRef,
    simRef,
    onPublishStats: publishStats,
    onTick: updateInstances,
  });

  return {
    simRef,
    updateInstances,
    clear,
    randomize,
    stepOnce,
    seedAtPoint,
  };
}
