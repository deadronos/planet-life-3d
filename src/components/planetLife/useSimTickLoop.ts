import { useEffect, useRef } from 'react';

import type { LifeSphereSim } from '../../sim/LifeSphereSim';
import type { LifeGridWorkerInMessage } from '../../workers/lifeGridWorkerMessages';

export interface UseSimTickLoopOptions {
  running: boolean;
  tickMs: number;
  workerEnabled: boolean;
  workerRef: React.RefObject<Worker | null>;
  workerTickInFlightRef: React.RefObject<boolean>;
  simRef: React.RefObject<LifeSphereSim | null>;
  onPublishStats: (sim: LifeSphereSim) => void;
  onTick: () => void;
}

export function useSimTickLoop({
  running,
  tickMs,
  workerEnabled,
  workerRef,
  workerTickInFlightRef,
  simRef,
  onPublishStats,
  onTick,
}: UseSimTickLoopOptions) {
  const tickLoopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!running) {
      tickLoopRef.current = null;
      return;
    }

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

            onPublishStats(sim);

            onTick();
          }
        }

        nextAt = performance.now() + safeTickMs;
        scheduleNext();
      }, delay);
    };

    tickLoopRef.current = scheduleNext;
    scheduleNext();

    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [
    running,
    tickMs,
    workerEnabled,
    workerRef,
    workerTickInFlightRef,
    simRef,
    onPublishStats,
    onTick,
  ]);
}
