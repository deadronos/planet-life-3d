export type Rules = {
  birth: boolean[]; // length 9, indexed by neighbor count
  survive: boolean[]; // length 9
};

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
