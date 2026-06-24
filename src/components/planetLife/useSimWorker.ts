import { useCallback, useEffect, useRef } from 'react';

import type {
  LifeGridWorkerInMessage,
  LifeGridWorkerOutMessage,
} from '../../workers/lifeGridWorkerMessages';

export interface WorkerSnapshot {
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
}

export interface UseSimWorkerOptions {
  workerEnabled: boolean;
  safeLatCells: number;
  safeLonCells: number;
  rules: import('../../sim/rules').Rules;
  ecologyProfile: import('../../sim/ecology').EcologyProfileName;
  randomDensity: number;
  gameMode: 'Classic' | 'Colony';
  debugLogs: boolean;
  onSnapshot: (msg: LifeGridWorkerOutMessage & { type: 'snapshot' }) => void;
}

export function useSimWorker({
  workerEnabled,
  safeLatCells,
  safeLonCells,
  rules,
  ecologyProfile,
  randomDensity,
  gameMode,
  debugLogs,
  onSnapshot,
}: UseSimWorkerOptions) {
  const workerRef = useRef<Worker | null>(null);
  const workerTickInFlightRef = useRef(false);
  const workerSnapshotRef = useRef<WorkerSnapshot | null>(null);
  const onSnapshotRef = useRef(onSnapshot);
  const debugLogsRef = useRef(debugLogs);

  // Mirror the latest callbacks in refs so the worker-lifecycle effect
  // below doesn't re-create the worker just because the parent passed a
  // new callback identity.
  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);
  useEffect(() => {
    debugLogsRef.current = debugLogs;
  }, [debugLogs]);

  const recycleBuffer = useCallback((held: WorkerSnapshot) => {
    const w = workerRef.current;
    if (!w) return;
    w.postMessage(
      {
        type: 'recycle',
        grid: held.buffers.grid,
        age: held.buffers.age,
        heat: held.buffers.heat,
        aliveIndices: held.buffers.aliveIndices,
      } satisfies LifeGridWorkerInMessage,
      [held.buffers.grid, held.buffers.age, held.buffers.heat, held.buffers.aliveIndices],
    );
  }, []);

  const returnHeldBuffers = useCallback(
    (held: WorkerSnapshot | null) => {
      if (!held || !workerRef.current) return;
      recycleBuffer(held);
      workerSnapshotRef.current = null;
    },
    [recycleBuffer],
  );

  // Worker lifecycle: create / terminate only when `workerEnabled` flips or
  // the grid resolution changes (which requires re-allocating the worker's
  // buffers). Earlier this effect also depended on rules / ecologyProfile /
  // randomDensity / gameMode, which caused the entire worker to be torn
  // down and re-created on every Leva knob change — wiping the running
  // simulation. The per-setting updates now live in the three effects
  // below, which post `setRules` / `setGameMode` / `setEcologyProfile`
  // messages to the existing worker.
  useEffect(() => {
    if (!workerEnabled) {
      workerTickInFlightRef.current = false;
      if (workerRef.current) {
        returnHeldBuffers(workerSnapshotRef.current);
        workerRef.current.terminate();
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

        const prev = workerSnapshotRef.current;
        if (prev) {
          recycleBuffer(prev);
        }

        workerSnapshotRef.current = {
          grid: new Uint8Array(msg.grid),
          age: new Uint8Array(msg.age),
          heat: new Uint8Array(msg.heat),
          aliveIndices: new Int32Array(msg.aliveIndices),
          population: msg.population,
          buffers: {
            grid: msg.grid,
            age: msg.age,
            heat: msg.heat,
            aliveIndices: msg.aliveIndices,
          },
        };

        onSnapshotRef.current(msg);
      }

      if (msg.type === 'error' && debugLogsRef.current) {
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
      gameMode,
      ecologyProfile,
      randomDensity,
    } satisfies LifeGridWorkerInMessage);

    return () => {
      w.removeEventListener('message', onMessage as EventListener);
      returnHeldBuffers(workerSnapshotRef.current);
      w.terminate();
      if (workerRef.current === w) workerRef.current = null;
      workerTickInFlightRef.current = false;
    };
    // Intentionally omit `rules`, `ecologyProfile`, `randomDensity`,
    // `gameMode`, `debugLogs`, `onSnapshot` from the dep list: those are
    // picked up via refs (debugLogs/onSnapshot) or pushed to the worker
    // by the per-setting effects below. Listing them here would re-create
    // the worker on every Leva change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerEnabled, safeLatCells, safeLonCells]);

  // Per-setting updates: post the appropriate `setX` message to the
  // existing worker instead of recreating it. These are cheap operations
  // the worker handles in place.
  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'setRules',
        rules,
      } satisfies LifeGridWorkerInMessage);
    }
  }, [rules]);

  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'setGameMode',
        mode: gameMode,
      } satisfies LifeGridWorkerInMessage);
    }
  }, [gameMode]);

  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'setEcologyProfile',
        profile: ecologyProfile,
      } satisfies LifeGridWorkerInMessage);
    }
  }, [ecologyProfile]);

  // (randomDensity is intentionally NOT pushed to the worker on change —
  // it only applies when the user explicitly clicks "Randomize", which
  // already sends a `randomize` message with the latest density.)

  const postMessage = useCallback((msg: LifeGridWorkerInMessage) => {
    workerRef.current?.postMessage(msg);
  }, []);

  return {
    workerRef,
    workerTickInFlightRef,
    workerSnapshotRef,
    postMessage,
  };
}
