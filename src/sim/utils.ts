import type { Vector3 } from 'three';

import type { Offset } from './patterns';

export const AGE_FADE_BASE = 0.35;
export const AGE_FADE_SCALE = 0.75;
export const AGE_FADE_MIN = 0.25;
export const AGE_FADE_MAX = 1.2;

export function clampRange(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function clamp01(v: number): number {
  return clampRange(v, 0, 1);
}

export function clampInt(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function safeInt(v: unknown, fallback: number, lo: number, hi: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return clampInt(Math.floor(n), lo, hi);
}

export function safeFloat(v: unknown, fallback: number, lo: number, hi: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return clampRange(n, lo, hi);
}

export function formatVector3(vector: Vector3, digits = 2): string {
  return vector
    .toArray()
    .map((v) => v.toFixed(digits))
    .join(',');
}

/**
 * Builds a filled disk of cell offsets with the given radius.
 *
 * The returned offsets are already in final cell units. Callers that later
 * run `transformOffsets` should pass `scale: 1` for disk patterns so the
 * radius is not scaled a second time (previously the disk radius was
 * `2 * scale` and then scaled by `scale` again, making the pattern size
 * grow quadratically with the seed-scale slider).
 */
export function buildRandomDiskOffsets(radius: number): Offset[] {
  const r = Math.max(1, Math.floor(radius));
  const offsets: Offset[] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) offsets.push([dy, dx]);
    }
  }
  return offsets;
}
