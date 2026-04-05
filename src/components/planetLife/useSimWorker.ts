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
  randomDensity,
  gameMode,
  debugLogs,
  onSnapshot,
}: UseSimWorkerOptions) {
  const workerRef = useRef<Worker | null>(null);
  const workerTickInFlightRef = useRef(false);
  const workerSnapshotRef = useRef<WorkerSnapshot | null>(null);

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

        onSnapshot(msg);
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
      gameMode,
      randomDensity,
    } satisfies LifeGridWorkerInMessage);

    return () => {
      w.removeEventListener('message', onMessage as EventListener);
      returnHeldBuffers(workerSnapshotRef.current);
      w.terminate();
      if (workerRef.current === w) workerRef.current = null;
      workerTickInFlightRef.current = false;
    };
  }, [
    workerEnabled,
    safeLatCells,
    safeLonCells,
    rules,
    randomDensity,
    debugLogs,
    gameMode,
    onSnapshot,
    recycleBuffer,
    returnHeldBuffers,
  ]);

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
