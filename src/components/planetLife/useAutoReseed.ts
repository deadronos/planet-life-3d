import { useEffect, useRef } from 'react';

import {
  AUTO_RESEED_COOLDOWN_MS,
  AUTO_RESEED_PERSIST_MS,
  type AutoReseedTrackerState,
  createAutoReseedState,
  evaluateAutoReseed,
  getAutoReseedWaitMs,
  resetAutoReseedPersistence,
  type SimStatus,
} from '../../utils/simStatus';

export interface UseAutoReseedOptions {
  enabled: boolean;
  running: boolean;
  status: SimStatus;
  onReseed: () => void;
  persistMs?: number;
  cooldownMs?: number;
}

/**
 * Triggers `onReseed` when stagnation or extinction persists while the
 * simulation is running and `enabled` is true, with a cooldown guard so
 * bursts never fire repeatedly on consecutive ticks.
 */
export function useAutoReseed({
  enabled,
  running,
  status,
  onReseed,
  persistMs = AUTO_RESEED_PERSIST_MS,
  cooldownMs = AUTO_RESEED_COOLDOWN_MS,
}: UseAutoReseedOptions): void {
  const trackerRef = useRef<AutoReseedTrackerState>(createAutoReseedState());

  useEffect(() => {
    if (!enabled || !running || status === 'active') {
      trackerRef.current = resetAutoReseedPersistence(trackerRef.current);
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;

    const arm = (atMs: number) => {
      const { shouldTrigger, nextState } = evaluateAutoReseed(trackerRef.current, {
        enabled,
        running,
        status,
        nowMs: atMs,
        persistMs,
        cooldownMs,
      });
      trackerRef.current = nextState;

      if (shouldTrigger) {
        onReseed();
      }

      if (cancelled) return;
      const delayMs = getAutoReseedWaitMs(trackerRef.current, {
        nowMs: atMs,
        persistMs,
        cooldownMs,
      });
      timeoutId = window.setTimeout(() => {
        if (!cancelled) arm(performance.now());
      }, delayMs);
    };

    arm(performance.now());

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [enabled, running, status, onReseed, persistMs, cooldownMs]);
}
