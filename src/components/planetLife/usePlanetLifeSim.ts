import { useCallback, useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { LifeSphereSim } from '../../sim/LifeSphereSim';
import type { Offset } from '../../sim/patterns';
import { spherePointToCell } from '../../sim/spherePointToCell';
import type { Rules } from '../../sim/rules';
import { useUIStore } from '../../store/useUIStore';
import type { ResolveCellColor } from './cellColor';
import { writeLifeTexture, type LifeTexture } from './lifeTexture';
import type { SeedMode } from '../../sim/LifeSimBase';
import type {
  LifeGridWorkerInMessage,
  LifeGridWorkerOutMessage,
} from '../../workers/lifeGridWorkerMessages';

export function usePlanetLifeSim({
  running,
  tickMs,
  safeLatCells,
  safeLonCells,
  planetRadius,
  cellLift,
  cellRenderMode,
  rules,
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
  rules: Rules;
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
  const instancingConfiguredRef = useRef(false);

  const workerRef = useRef<Worker | null>(null);
  const workerTickInFlightRef = useRef(false);
  const workerSnapshotRef = useRef<{
    grid: Uint8Array;
    age: Uint8Array;
    heat: Uint8Array;
    buffers: { grid: ArrayBuffer; age: ArrayBuffer; heat: ArrayBuffer };
  } | null>(null);

  const workerEnabled = workerSim && typeof Worker !== 'undefined';

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
      resolveCellColor,
      colorScratch,
      debugLogs,
    });
  }, [lifeTex, resolveCellColor, colorScratch, debugLogs, workerEnabled]);

  // Keep a ref to the latest updateInstances so effects that should only depend
  // on sizing don't accidentally re-create the simulation.
  const updateInstancesRef = useRef<() => void>(() => {
    /* noop */
  });

  const updateInstances = useCallback(() => {
    const sim = workerEnabled ? geometrySimRef.current : simRef.current;
    if (!sim) return;

    const snap = workerEnabled ? workerSnapshotRef.current : null;
    const grid = workerEnabled ? snap?.grid : simRef.current?.getGridView();
    const ages = workerEnabled ? snap?.age : simRef.current?.getAgeView();
    const heat = workerEnabled ? snap?.heat : simRef.current?.getNeighborHeatView();
    if (!grid || !ages || !heat) return;

    // Only update the overlay texture if it's actually being rendered.
    // This avoids a full per-cell RGBA write + GPU upload when in Dots mode.
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

    if (workerEnabled) {
      // Worker path: we render from the latest snapshot buffers.
      // We still use a main-thread LifeSphereSim instance for precomputed positions.
      const positions = sim.positions;
      for (let idx = 0; idx < grid.length; idx++) {
        if (grid[idx] !== 1) continue;
        dummy.position.copy(positions[idx]);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        resolveCellColor(idx, ages, heat, colorScratch);
        mesh.setColorAt(i, colorScratch);
        i++;
      }
    } else {
      sim.forEachAlive((idx) => {
        dummy.position.copy(sim.positions[idx]);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        resolveCellColor(idx, ages, heat, colorScratch);
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
    resolveCellColor,
    updateTexture,
    workerEnabled,
  ]);

  useEffect(() => {
    updateInstancesRef.current = updateInstances;
  }, [updateInstances]);

  // If the user switches to a mode that shows the overlay while paused,
  // ensure the texture reflects the current grid.
  useEffect(() => {
    if (cellRenderMode === 'Texture' || cellRenderMode === 'Both') updateTexture();
  }, [cellRenderMode, updateTexture]);

  const clear = useCallback(() => {
    if (workerEnabled && workerRef.current) {
      workerRef.current.postMessage({ type: 'clear' } satisfies LifeGridWorkerInMessage);
      return;
    }
    simRef.current?.clear();
    updateInstances();
  }, [updateInstances, workerEnabled]);

  const randomize = useCallback(() => {
    if (workerEnabled && workerRef.current) {
      workerRef.current.postMessage({
        type: 'randomize',
        density: randomDensity,
      } satisfies LifeGridWorkerInMessage);
      return;
    }
    simRef.current?.randomize(randomDensity);
    updateInstances();
  }, [randomDensity, updateInstances, workerEnabled]);

  const stepOnce = useCallback(() => {
    if (workerEnabled && workerRef.current) {
      if (workerTickInFlightRef.current) return;
      workerTickInFlightRef.current = true;
      workerRef.current.postMessage({ type: 'tick', steps: 1 } satisfies LifeGridWorkerInMessage);
      return;
    }
    simRef.current?.step();
    updateInstances();
  }, [updateInstances, workerEnabled]);

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
        workerRef.current.postMessage({
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
    [updateInstances, workerEnabled, safeLatCells, safeLonCells],
  );

  // (Re)create sim when grid or planet sizing changes
  useEffect(() => {
    instancingConfiguredRef.current = false;

    if (workerEnabled) {
      geometrySimRef.current = new LifeSphereSim({
        latCells: safeLatCells,
        lonCells: safeLonCells,
        planetRadius,
        cellLift,
        rules,
      });
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

    simRef.current = sim;
    geometrySimRef.current = sim;

    sim.randomize(randomDensity);
    updateInstancesRef.current();
  }, [safeLatCells, safeLonCells, planetRadius, cellLift, rules, randomDensity, workerEnabled]);

  // Update rules without resetting the grid
  useEffect(() => {
    if (workerEnabled && workerRef.current) {
      workerRef.current.postMessage({ type: 'setRules', rules } satisfies LifeGridWorkerInMessage);
      return;
    }
    simRef.current?.setRules(rules);
  }, [rules, workerEnabled]);

  // Worker lifecycle
  useEffect(() => {
    if (!workerEnabled) {
      // Disable worker if it was previously enabled.
      workerTickInFlightRef.current = false;
      if (workerRef.current) {
        const w = workerRef.current;
        const held = workerSnapshotRef.current;
        if (held) {
          w.postMessage(
            {
              type: 'recycle',
              grid: held.buffers.grid,
              age: held.buffers.age,
              heat: held.buffers.heat,
            } satisfies LifeGridWorkerInMessage,
            [held.buffers.grid, held.buffers.age, held.buffers.heat],
          );
          workerSnapshotRef.current = null;
        }
        w.terminate();
        workerRef.current = null;
      }
      return;
    }

    const w = new Worker(new URL('../../workers/simWorker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = w;
    workerTickInFlightRef.current = false;

    const onMessage = (event: MessageEvent<LifeGridWorkerOutMessage>) => {
      const msg = event.data;
      if (msg.type === 'snapshot') {
        workerTickInFlightRef.current = false;

        // Return previously held buffers before replacing.
        const prev = workerSnapshotRef.current;
        if (prev) {
          w.postMessage(
            {
              type: 'recycle',
              grid: prev.buffers.grid,
              age: prev.buffers.age,
              heat: prev.buffers.heat,
            } satisfies LifeGridWorkerInMessage,
            [prev.buffers.grid, prev.buffers.age, prev.buffers.heat],
          );
        }

        workerSnapshotRef.current = {
          grid: new Uint8Array(msg.grid),
          age: new Uint8Array(msg.age),
          heat: new Uint8Array(msg.heat),
          buffers: { grid: msg.grid, age: msg.age, heat: msg.heat },
        };

        useUIStore.getState().setStats({
          generation: msg.generation,
          population: msg.population,
          birthsLastTick: msg.birthsLastTick,
          deathsLastTick: msg.deathsLastTick,
        });

        updateInstancesRef.current();
      }

      if (msg.type === 'error' && debugLogs) {
        // eslint-disable-next-line no-console
        console.warn(`[PlanetLife] Worker sim error: ${msg.message}`);
      }
    };

    w.addEventListener('message', onMessage as EventListener);

    w.postMessage({
      type: 'init',
      latCells: safeLatCells,
      lonCells: safeLonCells,
      rules,
      randomDensity,
    } satisfies LifeGridWorkerInMessage);

    return () => {
      w.removeEventListener('message', onMessage as EventListener);
      const held = workerSnapshotRef.current;
      if (held) {
        w.postMessage(
          {
            type: 'recycle',
            grid: held.buffers.grid,
            age: held.buffers.age,
            heat: held.buffers.heat,
          } satisfies LifeGridWorkerInMessage,
          [held.buffers.grid, held.buffers.age, held.buffers.heat],
        );
        workerSnapshotRef.current = null;
      }
      w.terminate();
      if (workerRef.current === w) workerRef.current = null;
      workerTickInFlightRef.current = false;
    };
  }, [workerEnabled, safeLatCells, safeLonCells, rules, randomDensity, debugLogs]);

  // Tick loop
  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    let timeoutId: number | null = null;
    const safeTickMs = Number.isFinite(tickMs) ? Math.max(0, tickMs) : 0;
    let nextAt = performance.now() + safeTickMs;

    const scheduleNext = () => {
      if (cancelled) return;
      const delay = Math.max(0, nextAt - performance.now());
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        if (workerEnabled && workerRef.current) {
          // Prevent message backlog: only request the next tick when the previous one has returned.
          if (!workerTickInFlightRef.current) {
            workerTickInFlightRef.current = true;
            workerRef.current.postMessage({
              type: 'tick',
              steps: 1,
            } satisfies LifeGridWorkerInMessage);
          }
        } else {
          const sim = simRef.current;
          if (sim) {
            sim.step();

            useUIStore.getState().setStats({
              generation: sim.generation,
              population: sim.population,
              birthsLastTick: sim.birthsLastTick,
              deathsLastTick: sim.deathsLastTick,
            });

            updateInstances();
          }
        }

        // Schedule from "now" to avoid interval backlog when ticks are slow.
        nextAt = performance.now() + safeTickMs;
        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [running, tickMs, updateInstances, workerEnabled]);

  return {
    simRef,
    updateInstances,
    clear,
    randomize,
    stepOnce,
    seedAtPoint,
  };
}
