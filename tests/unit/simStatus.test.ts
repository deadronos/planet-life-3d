import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutoReseed } from '../../src/components/planetLife/useAutoReseed';
import { useUIStore } from '../../src/store/useUIStore';
import {
  AUTO_RESEED_COOLDOWN_MS,
  AUTO_RESEED_PERSIST_MS,
  createAutoReseedState,
  DEFAULT_OSCILLATOR_WINDOW,
  DEFAULT_STILL_LIFE_WINDOW,
  detectSimStatus,
  evaluateAutoReseed,
  getAutoReseedWaitMs,
  type SimStatsSample,
} from '../../src/utils/simStatus';

function makeSample(
  generation: number,
  population: number,
  birthsLastTick = 0,
  deathsLastTick = 0,
): SimStatsSample {
  return { generation, population, birthsLastTick, deathsLastTick };
}

describe('detectSimStatus', () => {
  it('returns active for empty history or cleared generation-0 world', () => {
    expect(detectSimStatus([])).toBe('active');
    expect(detectSimStatus([makeSample(0, 0, 0, 0)])).toBe('active');
  });

  it('detects extinction when population reaches 0 after generation > 0', () => {
    const history = [makeSample(1, 20, 4, 2), makeSample(2, 5, 0, 15), makeSample(3, 0, 0, 5)];
    expect(detectSimStatus(history)).toBe('extinct');
    expect(detectSimStatus([makeSample(1, 0, 0, 3)])).toBe('extinct');
  });

  it('returns active during active growth or fluctuating populations', () => {
    const growing = Array.from({ length: 16 }, (_, i) =>
      makeSample(i + 1, 50 + i * 7, 10 + (i % 3), 3 + (i % 2)),
    );
    expect(detectSimStatus(growing)).toBe('active');

    const fluctuating = [
      makeSample(1, 100, 12, 10),
      makeSample(2, 102, 15, 13),
      makeSample(3, 98, 9, 13),
      makeSample(4, 105, 18, 11),
      makeSample(5, 101, 11, 15),
      makeSample(6, 109, 20, 12),
      makeSample(7, 104, 10, 15),
      makeSample(8, 112, 19, 11),
      makeSample(9, 108, 13, 17),
      makeSample(10, 115, 21, 14),
      makeSample(11, 111, 14, 18),
      makeSample(12, 118, 22, 15),
    ];
    expect(detectSimStatus(fluctuating)).toBe('active');
  });

  it('detects static still-life equilibrium after consecutive zero-birth/zero-death ticks', () => {
    const tooShort = Array.from({ length: DEFAULT_STILL_LIFE_WINDOW - 1 }, (_, i) =>
      makeSample(i + 1, 42, 0, 0),
    );
    expect(detectSimStatus(tooShort)).toBe('active');

    const stillLife = [
      makeSample(1, 40, 5, 3),
      ...Array.from({ length: DEFAULT_STILL_LIFE_WINDOW }, (_, i) => makeSample(i + 2, 42, 0, 0)),
    ];
    expect(detectSimStatus(stillLife)).toBe('equilibrium');
  });

  it('detects period-2 oscillators over the sliding window', () => {
    // e.g. Beacon-like period-2 pattern alternating (pop 6, b 0, d 2) and (pop 8, b 2, d 0)
    const history = Array.from({ length: DEFAULT_OSCILLATOR_WINDOW }, (_, i) =>
      i % 2 === 0 ? makeSample(i + 1, 6, 0, 2) : makeSample(i + 1, 8, 2, 0),
    );
    expect(detectSimStatus(history)).toBe('equilibrium');
  });

  it('detects period-3 oscillators over the sliding window', () => {
    const cycle = [
      { pop: 48, b: 12, d: 8 },
      { pop: 52, b: 16, d: 12 },
      { pop: 44, b: 8, d: 16 },
    ];
    const history = [
      makeSample(1, 90, 20, 10),
      makeSample(2, 65, 8, 33),
      ...Array.from({ length: DEFAULT_OSCILLATOR_WINDOW }, (_, i) => {
        const phase = cycle[i % 3];
        return makeSample(i + 3, phase.pop, phase.b, phase.d);
      }),
    ];
    expect(detectSimStatus(history)).toBe('equilibrium');
  });

  it('returns to active immediately when a seed changes population', () => {
    const history = Array.from({ length: DEFAULT_STILL_LIFE_WINDOW }, (_, i) =>
      makeSample(i + 1, 20, 0, 0),
    );
    expect(detectSimStatus(history)).toBe('equilibrium');

    const afterSeed = [...history.slice(0, -1), makeSample(DEFAULT_STILL_LIFE_WINDOW, 35, 0, 0)];
    expect(detectSimStatus(afterSeed)).toBe('active');
  });
});

describe('useUIStore statsHistory integration', () => {
  beforeEach(() => {
    useUIStore.setState({
      stats: { generation: 0, population: 0, birthsLastTick: 0, deathsLastTick: 0 },
      populationHistory: [],
      statsHistory: [],
    });
  });

  it('tracks statsHistory across ticks and resets on generation rollback', () => {
    const { setStats } = useUIStore.getState();
    for (let g = 1; g <= DEFAULT_STILL_LIFE_WINDOW; g++) {
      setStats(makeSample(g, 12, 0, 0));
    }
    expect(detectSimStatus(useUIStore.getState().statsHistory)).toBe('equilibrium');

    // Manual seed at same generation updates latest sample and breaks equilibrium
    setStats(makeSample(DEFAULT_STILL_LIFE_WINDOW, 25, 0, 0));
    expect(detectSimStatus(useUIStore.getState().statsHistory)).toBe('active');

    // Randomize/Clear resets generation back to 0
    setStats(makeSample(0, 0, 0, 0));
    expect(useUIStore.getState().statsHistory).toHaveLength(1);
    expect(detectSimStatus(useUIStore.getState().statsHistory)).toBe('active');
  });
});

describe('auto-reseed evaluation & hook', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('enforces persistence delay and cooldown without spamming', () => {
    let state = createAutoReseedState();

    // Disabled or paused or active does not trigger
    const disabled = evaluateAutoReseed(state, {
      enabled: false,
      running: true,
      status: 'extinct',
      nowMs: 1000,
    });
    expect(disabled.shouldTrigger).toBe(false);

    // First observation of extinction starts persistence clock
    const first = evaluateAutoReseed(state, {
      enabled: true,
      running: true,
      status: 'extinct',
      nowMs: 1000,
    });
    expect(first.shouldTrigger).toBe(false);
    state = first.nextState;
    expect(state.stagnantSinceMs).toBe(1000);

    // Before persistMs elapsed -> no trigger
    const tooEarly = evaluateAutoReseed(state, {
      enabled: true,
      running: true,
      status: 'extinct',
      nowMs: 1000 + AUTO_RESEED_PERSIST_MS - 1,
    });
    expect(tooEarly.shouldTrigger).toBe(false);

    // At persistMs -> triggers once
    const triggered = evaluateAutoReseed(tooEarly.nextState, {
      enabled: true,
      running: true,
      status: 'extinct',
      nowMs: 1000 + AUTO_RESEED_PERSIST_MS,
    });
    expect(triggered.shouldTrigger).toBe(true);
    state = triggered.nextState;

    // Immediately on next tick -> blocked by cooldown guard
    const duringCooldown = evaluateAutoReseed(state, {
      enabled: true,
      running: true,
      status: 'extinct',
      nowMs: 1000 + AUTO_RESEED_PERSIST_MS + 120,
    });
    expect(duringCooldown.shouldTrigger).toBe(false);
    expect(
      getAutoReseedWaitMs(duringCooldown.nextState, {
        nowMs: 1000 + AUTO_RESEED_PERSIST_MS + 120,
      }),
    ).toBeGreaterThan(0);

    // After cooldown elapsed -> can trigger again if still stagnant
    const afterCooldown = evaluateAutoReseed(duringCooldown.nextState, {
      enabled: true,
      running: true,
      status: 'extinct',
      nowMs: 1000 + AUTO_RESEED_PERSIST_MS + AUTO_RESEED_COOLDOWN_MS,
    });
    expect(afterCooldown.shouldTrigger).toBe(true);
  });

  it('useAutoReseed fires after persistence delay and respects cooldown and pause', () => {
    vi.useFakeTimers();
    const onReseed = vi.fn();

    const { rerender, unmount } = renderHook(
      (props: {
        enabled: boolean;
        running: boolean;
        status: 'active' | 'equilibrium' | 'extinct';
      }) =>
        useAutoReseed({
          ...props,
          onReseed,
          persistMs: 2000,
          cooldownMs: 5000,
        }),
      {
        initialProps: { enabled: false, running: true, status: 'extinct' },
      },
    );

    // Disabled -> never fires
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onReseed).not.toHaveBeenCalled();

    // Enable while paused -> never fires
    rerender({ enabled: true, running: false, status: 'extinct' });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onReseed).not.toHaveBeenCalled();

    // Resume while extinct -> fires once after 2000ms
    rerender({ enabled: true, running: true, status: 'extinct' });
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(onReseed).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onReseed).toHaveBeenCalledTimes(1);

    // Next 4999ms -> cooldown prevents spam
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(onReseed).toHaveBeenCalledTimes(1);

    // At 5000ms -> triggers again if still stagnant
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onReseed).toHaveBeenCalledTimes(2);

    // Returning to active cancels pending timer
    rerender({ enabled: true, running: true, status: 'active' });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onReseed).toHaveBeenCalledTimes(2);

    unmount();
  });
});
