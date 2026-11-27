import { type RefObject, useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';

import { useDocumentHidden } from '../../hooks/useDocumentHidden';
import { SOIL_NEUTRAL } from '../../sim/ecology';
import { LifeSphereSim } from '../../sim/LifeSphereSim';
import type { Offset } from '../../sim/patterns';
import { normalizeDecayStates, type Rules } from '../../sim/rules';
import { createSeededRng } from '../../sim/seededRng';
import { spherePointToCell } from '../../sim/spherePointToCell';
import type { SeedMode } from '../../sim/types';
import { useUIStore } from '../../store/useUIStore';
import type { LifeGridWorkerInMessage } from '../../workers/lifeGridWorkerMessages';
import type { ResolveCellColor } from './cellColor';
import type { CellsSlice, DebugSlice, PlanetSlice, SimSlice } from './controls';
import { type LifeTexture } from './lifeTexture';
import { useSimInstances } from './useSimInstances';
import { useSimTickLoop } from './useSimTickLoop';
import { useSimWorker } from './useSimWorker';

export function usePlanetLifeSim({
  sim,
  planet,
  cells,
  debug,
  safeLatCells,
  safeLonCells,
  rules,
  lifeTex,
  cellsRef,
  resolveCellColor,
  colorScratch,
}: {
  sim: SimSlice;
  planet: PlanetSlice;
  cells: CellsSlice;
  debug: DebugSlice;
  safeLatCells: number;
  safeLonCells: number;
  rules: Rules;
  lifeTex: LifeTexture;
  cellsRef: RefObject<THREE.InstancedMesh | null>;
  resolveCellColor: ResolveCellColor;
  colorScratch: THREE.Color;
}) {
  const {
    running,
    tickMs,
    ecologyProfile,
    solarCycleSpeed = 0,
    dynamicFertility = false,
    randomDensity,
    gameMode,
  } = sim;
  const polarWrap = sim.polarWrap ?? false;
  const colonyBiomeAffinity = sim.colonyBiomeAffinity ?? false;
  const { planetRadius } = planet;
  const { cellLift, cellRenderMode } = cells;
  const { workerSim, gpuSim, debugLogs } = debug;
  const simRef = useRef<LifeSphereSim | null>(null);
  const geometrySimRef = useRef<LifeSphereSim | null>(null);
  const updateInstancesRef = useRef<() => void>(() => {
    /* noop */
  });

  const workerEnabled = !gpuSim && workerSim && typeof Worker !== 'undefined';

  const publishStats = useCallback(
    (source: {
      generation: number;
      population: number;
      colonyAPopulation?: number;
      colonyBPopulation?: number;
      birthsLastTick: number;
      deathsLastTick: number;
    }) => {
      useUIStore.getState().setStats({
        generation: source.generation,
        population: source.population,
        colonyAPopulation: source.colonyAPopulation,
        colonyBPopulation: source.colonyBPopulation,
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
      colonyAPopulation?: number;
      colonyBPopulation?: number;
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
    polarWrap,
    colonyBiomeAffinity,
    solarCycleSpeed,
    dynamicFertility,
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
    colorScratch,
    resolveCellColor,
    gameMode,
    decayStates: normalizeDecayStates(rules.decayStates),
    debugLogs,
  });

  useEffect(() => {
    updateInstancesRef.current = updateInstances;
  }, [updateInstances]);

  useEffect(() => {
    if (!gpuSim && (cellRenderMode === 'Texture' || cellRenderMode === 'Both')) updateTexture();
  }, [gpuSim, cellRenderMode, updateTexture]);

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
        seed: useUIStore.getState().worldSeed,
      } satisfies LifeGridWorkerInMessage);
      return;
    }
    const sim = simRef.current;
    sim?.randomize(randomDensity, createSeededRng(useUIStore.getState().worldSeed));
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
      fertilityDelta?: number;
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
          fertilityDelta: params.fertilityDelta,
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
        fertilityDelta: params.fertilityDelta,
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

  // Sim lifecycle: skip CPU/Worker allocation while gpuSim is authoritative,
  // and only re-create the sim when gpuSim turns off, the grid resolution
  // changes, or worker mode toggles. Per-setting
  // changes (rules, gameMode, ecologyProfile) are applied in place by the
  // three per-setting effects below, and the randomDensity slider no
  // longer wipes the world — it's only sampled when the user explicitly
  // clicks the Randomize action. Planet radius / cell lift are handled by a
  // separate geometry-only effect below so they don't wipe the world either.
  useEffect(() => {
    if (gpuSim) {
      simRef.current = null;
      geometrySimRef.current = null;
      return;
    }

    if (workerEnabled) {
      // In worker mode we still keep a geometry-only sim around for the
      // instanced-mesh dots path, but the authoritative state lives in
      // the worker. Per-setting worker updates are posted inside
      // useSimWorker.
      geometrySimRef.current = new LifeSphereSim({
        latCells: safeLatCells,
        lonCells: safeLonCells,
        planetRadius,
        cellLift,
        rules,
      });
      geometrySimRef.current.setGameMode(gameMode);
      geometrySimRef.current.setEcologyProfile(ecologyProfile);
      geometrySimRef.current.setPolarWrap(polarWrap);
      geometrySimRef.current.setColonyBiomeAffinity(colonyBiomeAffinity);
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
      polarWrap,
    });
    sim.setGameMode(gameMode);
    sim.setEcologyProfile(ecologyProfile);
    sim.setColonyBiomeAffinity(colonyBiomeAffinity);
    sim.setSolarCycleSpeed(solarCycleSpeed);
    sim.setDynamicFertility(dynamicFertility);

    simRef.current = sim;
    geometrySimRef.current = sim;

    sim.randomize(randomDensityRef.current, createSeededRng(useUIStore.getState().worldSeed));
    updateInstancesRef.current();
    // Intentionally omit `rules`, `ecologyProfile`, `randomDensity`, and
    // `gameMode` from the dep list. rules/gameMode/ecologyProfile are
    // pushed to the sim in place by the per-setting effects below;
    // randomDensity is sampled on demand from randomDensityRef when the
    // user clicks Randomize. Listing them here would recreate the sim
    // (and re-randomize) on every Leva change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load-bearing: values are routed via refs; see the comment above and the regression tests in tests/unit/usePlanetLifeSim.test.ts.
  }, [gpuSim, safeLatCells, safeLonCells, workerEnabled]);

  // Geometry-only updates (planetRadius / cellLift) recompute surface
  // positions in place instead of recreating the sim — recreating would
  // re-randomize the world every time the user drags one of these sliders.
  useEffect(() => {
    simRef.current?.updateSurfaceGeometry(planetRadius, cellLift);
    geometrySimRef.current?.updateSurfaceGeometry(planetRadius, cellLift);
    updateInstancesRef.current();
  }, [planetRadius, cellLift]);

  // Worker `setRules` / `setGameMode` / `setEcologyProfile` sync lives
  // exclusively in `useSimWorker`; only update `simRef.current` in CPU mode.
  useEffect(() => {
    if (!workerEnabled) {
      simRef.current?.setRules(rules);
    }
  }, [rules, workerEnabled]);

  useEffect(() => {
    if (!workerEnabled) {
      simRef.current?.setGameMode(gameMode);
    }
  }, [gameMode, workerEnabled]);

  useEffect(() => {
    if (!workerEnabled) {
      simRef.current?.setEcologyProfile(ecologyProfile);
    }
  }, [ecologyProfile, workerEnabled]);

  useEffect(() => {
    if (!workerEnabled) {
      simRef.current?.setPolarWrap(polarWrap);
    }
  }, [polarWrap, workerEnabled]);

  useEffect(() => {
    if (!workerEnabled) {
      simRef.current?.setColonyBiomeAffinity(colonyBiomeAffinity);
    }
  }, [colonyBiomeAffinity, workerEnabled]);

  useEffect(() => {
    if (!workerEnabled) {
      simRef.current?.setSolarCycleSpeed(solarCycleSpeed);
    }
  }, [solarCycleSpeed, workerEnabled]);

  useEffect(() => {
    if (!workerEnabled) {
      simRef.current?.setDynamicFertility(dynamicFertility);
    }
  }, [dynamicFertility, workerEnabled]);

  const getEcologyCellState = useCallback(
    (lat: number, lon: number): { solarPhase: number; soilByte: number } => {
      const idx =
        Math.max(0, Math.min(safeLatCells - 1, lat)) * safeLonCells +
        (((lon % safeLonCells) + safeLonCells) % safeLonCells);
      if (workerEnabled) {
        const snap = workerSnapshotRef.current;
        return {
          solarPhase: snap?.solarPhase ?? 0,
          soilByte: snap?.soil[idx] ?? SOIL_NEUTRAL,
        };
      }
      const sim = simRef.current;
      return {
        solarPhase: sim?.getSolarPhase() ?? 0,
        soilByte: sim?.getSoilView()[idx] ?? SOIL_NEUTRAL,
      };
    },
    [safeLatCells, safeLonCells, workerEnabled, workerSnapshotRef],
  );

  const documentHidden = useDocumentHidden();

  useSimTickLoop({
    // The CPU/worker sim is paused while the GPU sim is authoritative. It
    // remains initialized purely as a texture fallback if the GPU path
    // fails, and its stats are never published in GPU mode.
    running: running && !gpuSim && !documentHidden,
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
    getEcologyCellState,
  };
}
