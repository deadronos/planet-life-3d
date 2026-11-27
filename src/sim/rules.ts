import { safeInt } from './utils';

export const MIN_DECAY_STATES = 2;
export const MAX_DECAY_STATES = 16;
export const DEFAULT_DECAY_STATES = 2;

export type Rules = {
  birth: boolean[]; // length 9, indexed by neighbor count
  survive: boolean[]; // length 9
  /** Number of Generations states (2 = classic binary Life, 3..16 = refractory decay). */
  decayStates?: number;
};

/**
 * Clamp and normalize a Generations state count into the supported [2..16] integer range.
 */
export function normalizeDecayStates(value: unknown): number {
  return safeInt(value, DEFAULT_DECAY_STATES, MIN_DECAY_STATES, MAX_DECAY_STATES);
}

/**
 * Parses rule digits like "3" or "23" into a boolean lookup table indexed by neighbor count [0..8].
 *
 * Defensive: some UI libs can momentarily hand back numbers/undefined while editing.
 */
export function parseRuleDigits(digits: unknown): boolean[] {
  let s = '';
  if (typeof digits === 'string') s = digits;
  else if (typeof digits === 'number' && Number.isFinite(digits)) s = String(digits);
  const arr = Array.from({ length: 9 }, () => false);
  for (const ch of s) {
    const n = ch.charCodeAt(0) - 48;
    if (n >= 0 && n <= 8) arr[n] = true;
  }
  return arr;
}
