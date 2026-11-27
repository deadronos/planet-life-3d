export type SimStatus = 'active' | 'equilibrium' | 'extinct';

export interface SimStatsSample {
  generation: number;
  population: number;
  birthsLastTick: number;
  deathsLastTick: number;
}

export interface SimStatusOptions {
  /** Consecutive zero-birth/zero-death samples required for static still-life equilibrium. */
  stillLifeWindow?: number;
  /** Sliding window length for small-period oscillator detection. */
  oscillatorWindow?: number;
  /** Maximum repeating period (in samples) considered a small-period oscillator. */
  maxOscillatorPeriod?: number;
}

export const DEFAULT_STILL_LIFE_WINDOW = 6;
export const DEFAULT_OSCILLATOR_WINDOW = 12;
export const DEFAULT_MAX_OSCILLATOR_PERIOD = 6;
export const STATS_HISTORY_LENGTH = 32;

export const AUTO_RESEED_PERSIST_MS = 2000;
export const AUTO_RESEED_COOLDOWN_MS = 5000;

/** Returns a new stats history window with `sample` appended, dropping the oldest past the cap. */
export function appendStatsSample(
  history: readonly SimStatsSample[],
  sample: SimStatsSample,
  maxLength: number = STATS_HISTORY_LENGTH,
): SimStatsSample[] {
  const next =
    history.length >= maxLength ? history.slice(history.length - maxLength + 1) : history.slice();
  next.push(sample);
  return next;
}

/** Replaces the newest stats sample (same generation re-published, e.g. paused or after a seed). */
export function replaceLastStatsSample(
  history: readonly SimStatsSample[],
  sample: SimStatsSample,
): SimStatsSample[] {
  if (history.length === 0) return [sample];
  const next = history.slice();
  next[next.length - 1] = sample;
  return next;
}

/**
 * Classify simulation state from recent stats samples.
 *
 * - `extinct`: `population === 0` after at least one step (`generation > 0`).
 * - `equilibrium`: static still-life (`births === 0 && deaths === 0` and constant
 *   positive population over `stillLifeWindow` samples) or steady small-period
 *   oscillator (repeating `(population, birthsLastTick, deathsLastTick)` pattern
 *   with period `1..maxOscillatorPeriod` across `oscillatorWindow` samples).
 * - `active`: otherwise (including cleared/unstarted `generation === 0`).
 */
export function detectSimStatus(
  history: readonly SimStatsSample[],
  options: SimStatusOptions = {},
): SimStatus {
  if (history.length === 0) return 'active';

  const latest = history[history.length - 1];
  if (latest.population === 0) {
    return latest.generation > 0 ? 'extinct' : 'active';
  }

  const stillLifeWindow = Math.max(
    2,
    Math.floor(options.stillLifeWindow ?? DEFAULT_STILL_LIFE_WINDOW),
  );
  if (history.length >= stillLifeWindow) {
    const start = history.length - stillLifeWindow;
    let isStillLife = true;
    for (let i = start; i < history.length; i++) {
      const s = history[i];
      if (s.population !== latest.population || s.birthsLastTick !== 0 || s.deathsLastTick !== 0) {
        isStillLife = false;
        break;
      }
    }
    if (isStillLife) return 'equilibrium';
  }

  const oscillatorWindow = Math.max(
    4,
    Math.floor(options.oscillatorWindow ?? DEFAULT_OSCILLATOR_WINDOW),
  );
  if (history.length >= oscillatorWindow) {
    const start = history.length - oscillatorWindow;
    let allAlive = true;
    for (let i = start; i < history.length; i++) {
      if (history[i].population <= 0) {
        allAlive = false;
        break;
      }
    }

    if (allAlive) {
      const maxPeriod = Math.min(
        Math.max(1, Math.floor(options.maxOscillatorPeriod ?? DEFAULT_MAX_OSCILLATOR_PERIOD)),
        Math.floor(oscillatorWindow / 2),
      );
      for (let period = 1; period <= maxPeriod; period++) {
        let matchesPeriod = true;
        for (let i = start + period; i < history.length; i++) {
          const curr = history[i];
          const prev = history[i - period];
          if (
            curr.population !== prev.population ||
            curr.birthsLastTick !== prev.birthsLastTick ||
            curr.deathsLastTick !== prev.deathsLastTick
          ) {
            matchesPeriod = false;
            break;
          }
        }
        if (matchesPeriod) return 'equilibrium';
      }
    }
  }

  return 'active';
}

export interface AutoReseedTrackerState {
  stagnantSinceMs: number | null;
  lastReseedAtMs: number | null;
}

export interface AutoReseedEvalParams {
  enabled: boolean;
  running: boolean;
  status: SimStatus;
  nowMs: number;
  persistMs?: number;
  cooldownMs?: number;
}

export interface AutoReseedEvalResult {
  shouldTrigger: boolean;
  nextState: AutoReseedTrackerState;
}

export function createAutoReseedState(): AutoReseedTrackerState {
  return { stagnantSinceMs: null, lastReseedAtMs: null };
}

export function resetAutoReseedPersistence(state: AutoReseedTrackerState): AutoReseedTrackerState {
  if (state.stagnantSinceMs === null) return state;
  return { stagnantSinceMs: null, lastReseedAtMs: state.lastReseedAtMs };
}

/**
 * Evaluate whether an auto-reseed burst should fire right now, enforcing both
 * a persistence delay (so transient or freshly settled worlds aren't cut off
 * immediately) and a cooldown (so bursts never spam every tick).
 */
export function evaluateAutoReseed(
  state: AutoReseedTrackerState,
  {
    enabled,
    running,
    status,
    nowMs,
    persistMs = AUTO_RESEED_PERSIST_MS,
    cooldownMs = AUTO_RESEED_COOLDOWN_MS,
  }: AutoReseedEvalParams,
): AutoReseedEvalResult {
  if (!enabled || !running || status === 'active') {
    return {
      shouldTrigger: false,
      nextState: resetAutoReseedPersistence(state),
    };
  }

  const stagnantSinceMs = state.stagnantSinceMs ?? nowMs;
  const persisted = nowMs - stagnantSinceMs >= Math.max(0, persistMs);
  const cooldownReady =
    state.lastReseedAtMs === null || nowMs - state.lastReseedAtMs >= Math.max(0, cooldownMs);

  if (persisted && cooldownReady) {
    return {
      shouldTrigger: true,
      nextState: {
        stagnantSinceMs: nowMs,
        lastReseedAtMs: nowMs,
      },
    };
  }

  return {
    shouldTrigger: false,
    nextState:
      state.stagnantSinceMs === stagnantSinceMs
        ? state
        : { stagnantSinceMs, lastReseedAtMs: state.lastReseedAtMs },
  };
}

/** Compute the remaining milliseconds until both persistence and cooldown are satisfied. */
export function getAutoReseedWaitMs(
  state: AutoReseedTrackerState,
  {
    nowMs,
    persistMs = AUTO_RESEED_PERSIST_MS,
    cooldownMs = AUTO_RESEED_COOLDOWN_MS,
  }: { nowMs: number; persistMs?: number; cooldownMs?: number },
): number {
  const safePersist = Math.max(0, persistMs);
  const safeCooldown = Math.max(0, cooldownMs);
  const persistReadyAt = (state.stagnantSinceMs ?? nowMs) + safePersist;
  const cooldownReadyAt =
    state.lastReseedAtMs === null ? nowMs : state.lastReseedAtMs + safeCooldown;
  return Math.max(1, Math.ceil(Math.max(persistReadyAt, cooldownReadyAt) - nowMs));
}
