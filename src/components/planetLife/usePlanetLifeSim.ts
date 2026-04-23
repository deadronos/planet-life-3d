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
      publishStats(msg);
      updateInstancesRef.current();
    },
    [publishStats],
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
    if (sim) publishStats(sim);
    updateInstances();
  }, [publishStats, updateInstances, workerEnabled, workerRef, workerPostMessage]);

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
    if (sim) publishStats(sim);
    updateInstances();
  }, [publishStats, randomDensity, updateInstances, workerEnabled, workerRef, workerPostMessage]);

  const stepOnce = useCallback(() => {
    if (workerEnabled && workerRef.current) {
      if (workerTickInFlightRef.current) return;
      workerTickInFlightRef.current = true;
      workerPostMessage({ type: 'tick', steps: 1 } satisfies LifeGridWorkerInMessage);
      return;
    }
    const sim = simRef.current;
    sim?.step();
    if (sim) publishStats(sim);
    updateInstances();
  }, [
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

      simRef.current?.seedAtPoint({
        point: params.point,
        offsets: params.offsets,
        mode: params.mode,
        scale: params.scale,
        jitter: params.jitter,
        probability: params.probability,
        debug: params.debug,
      });
      updateInstances();
    },
    [updateInstances, workerEnabled, workerRef, workerPostMessage, safeLatCells, safeLonCells],
  );

  /* eslint-disable react-hooks/exhaustive-deps */
  // Intentionally omit `gameMode` from the dependency array: we update it in a separate
  // effect to avoid recreating the full simulation (and re-randomizing) when only
  // the game mode changes.
  useEffect(() => {
    if (workerEnabled) {
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

    sim.randomize(randomDensity);
    updateInstancesRef.current();
  }, [
    safeLatCells,
    safeLonCells,
    planetRadius,
    cellLift,
    rules,
    ecologyProfile,
    randomDensity,
    workerEnabled,
  ]);

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
    running,
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
