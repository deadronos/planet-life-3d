export const POPULATION_HISTORY_LENGTH = 200;

/** Returns a new window with `value` appended, dropping the oldest sample past the cap. */
export function appendSample(history: readonly number[], value: number): number[] {
  const next = history.length >= POPULATION_HISTORY_LENGTH ? history.slice(1) : history.slice();
  next.push(value);
  return next;
}

/** Replaces the newest sample (same generation re-published, e.g. paused or after a seed). */
export function replaceLastSample(history: readonly number[], value: number): number[] {
  if (history.length === 0) return [value];
  const next = history.slice();
  next[next.length - 1] = value;
  return next;
}

export function sparklinePoints(
  history: readonly number[],
  width: number,
  height: number,
  pad = 2,
): string {
  if (history.length < 2) return '';
  const min = Math.min(...history);
  const max = Math.max(...history);
  const span = max - min || 1;
  const inner = height - pad * 2;
  const step = width / (history.length - 1);
  return history
    .map((v, i) => {
      const y = max === min ? height / 2 : pad + inner - ((v - min) / span) * inner;
      return `${(i * step).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function describePopulationTrend(history: readonly number[]): string {
  if (history.length === 0) return 'Population history unavailable';
  const fmt = (n: number) => n.toLocaleString('en-US');
  const now = history[history.length - 1];
  if (now === 0 && history.length > 1) return 'Population extinct, 0 now';
  if (history.length < 2) return `Population ${fmt(now)} now`;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const recent = history.slice(-Math.min(history.length, 20));
  const delta = now - recent[0];
  const tolerance = Math.max(1, (max - min) * 0.05, now * 0.01);
  const trend = Math.abs(delta) <= tolerance ? 'steady' : delta > 0 ? 'rising' : 'falling';
  return `Population ${trend}, ${fmt(now)} now, range ${fmt(min)}–${fmt(max)}`;
}
