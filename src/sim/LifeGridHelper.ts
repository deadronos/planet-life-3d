import type { Rules } from './rules';
import type { GameMode, SeedMode } from './types';

export type ColonyStats = {
  neighbors: number;
  countA: number;
};

export interface LifeGridStepContext {
  readonly latCells: number;
  readonly lonCells: number;
  readonly grid: Uint8Array;
  readonly next: Uint8Array;
  readonly age: Uint8Array;
  readonly ageNext: Uint8Array;
  readonly neighborHeatNext: Uint8Array;
  readonly nextAliveIndices: Int32Array;
  readonly rules: Rules;
  readonly ecologyBias: Int8Array | null;
  readonly polarWrap: boolean;
  birthsLastTick: number;
  deathsLastTick: number;
  population: number;
  colonyAPopulation: number;
  colonyBPopulation: number;
  nextAliveCount: number;
}

/**
 * Apply cached per-cell ecology neighbor bias, clamping to [0, 8].
 * Returns `rawNeighbors` untouched when `ecologyBias` is null (`None` profile).
 */
export function applyEcologyBias(
  rawNeighbors: number,
  idx: number,
  ecologyBias: Int8Array | null,
): number {
  if (ecologyBias === null) return rawNeighbors;
  const biased = rawNeighbors + ecologyBias[idx];
  return biased < 0 ? 0 : biased > 8 ? 8 : biased;
}

/**
 * Write the next-tick cell state, age, neighbor heat, and population counters
 * into the active step context.
 */
export function applyCellUpdate(
  ctx: LifeGridStepContext,
  idx: number,
  currentVal: number,
  nextVal: number,
  neighbors: number,
): void {
  if (nextVal > 0) {
    if (currentVal === 0) ctx.birthsLastTick++;
    ctx.population++;
    if (nextVal === 1) ctx.colonyAPopulation++;
    else ctx.colonyBPopulation++;
    const nextAge = ctx.age[idx] + 1;
    ctx.ageNext[idx] = nextAge > 255 ? 255 : nextAge;
    ctx.neighborHeatNext[idx] = neighbors;
    ctx.nextAliveIndices[ctx.nextAliveCount++] = idx;
  } else {
    if (currentVal > 0) ctx.deathsLastTick++;
    ctx.ageNext[idx] = 0;
    ctx.neighborHeatNext[idx] = 0;
  }
  ctx.next[idx] = nextVal;
}

/**
 * Shift a longitude index by `shift` (`0 <= shift < lonCells`) with wrap-around.
 */
export function shiftLon(lon: number, shift: number, lonCells: number): number {
  if (shift === 0) return lon;
  const shifted = lon + shift;
  return shifted >= lonCells ? shifted - lonCells : shifted;
}

/**
 * Sum neighbors for Classic mode (values are 0 or 1).
 * Specifically for edge cases (longitude seam and polar-wrap boundary rows)
 * where we can't use the sliding window optimization.
 */
export function sumNeighborsEdge(
  grid: Uint8Array,
  rTop: number,
  rMid: number,
  rBot: number,
  hasTop: boolean,
  hasBot: boolean,
  left: number,
  lo: number,
  right: number,
  topShift = 0,
  botShift = 0,
  lonCells = 0,
): number {
  let neighbors = 0;
  if (hasTop) {
    const tl = shiftLon(left, topShift, lonCells);
    const tm = shiftLon(lo, topShift, lonCells);
    const tr = shiftLon(right, topShift, lonCells);
    neighbors += grid[rTop + tl] + grid[rTop + tm] + grid[rTop + tr];
  }
  neighbors += grid[rMid + left] + grid[rMid + right];
  if (hasBot) {
    const bl = shiftLon(left, botShift, lonCells);
    const bm = shiftLon(lo, botShift, lonCells);
    const br = shiftLon(right, botShift, lonCells);
    neighbors += grid[rBot + bl] + grid[rBot + bm] + grid[rBot + br];
  }
  return neighbors;
}

/**
 * Count neighbors for Colony mode (values are 0, 1, 2).
 * Updates the stats object in place.
 */
export function countNeighborsColony(
  grid: Uint8Array,
  rTop: number,
  rMid: number,
  rBot: number,
  hasTop: boolean,
  hasBot: boolean,
  left: number,
  lo: number,
  right: number,
  stats: ColonyStats,
  topShift = 0,
  botShift = 0,
  lonCells = 0,
): void {
  let neighbors = 0;
  let countA = 0;

  if (hasTop) {
    const tl = shiftLon(left, topShift, lonCells);
    const tm = shiftLon(lo, topShift, lonCells);
    const tr = shiftLon(right, topShift, lonCells);
    const t0 = grid[rTop + tl];
    const t1 = grid[rTop + tm];
    const t2 = grid[rTop + tr];
    neighbors += (t0 > 0 ? 1 : 0) + (t1 > 0 ? 1 : 0) + (t2 > 0 ? 1 : 0);
    countA += (t0 === 1 ? 1 : 0) + (t1 === 1 ? 1 : 0) + (t2 === 1 ? 1 : 0);
  }

  const m0 = grid[rMid + left];
  const m2 = grid[rMid + right];
  neighbors += (m0 > 0 ? 1 : 0) + (m2 > 0 ? 1 : 0);
  countA += (m0 === 1 ? 1 : 0) + (m2 === 1 ? 1 : 0);

  if (hasBot) {
    const bl = shiftLon(left, botShift, lonCells);
    const bm = shiftLon(lo, botShift, lonCells);
    const br = shiftLon(right, botShift, lonCells);
    const b0 = grid[rBot + bl];
    const b1 = grid[rBot + bm];
    const b2 = grid[rBot + br];
    neighbors += (b0 > 0 ? 1 : 0) + (b1 > 0 ? 1 : 0) + (b2 > 0 ? 1 : 0);
    countA += (b0 === 1 ? 1 : 0) + (b1 === 1 ? 1 : 0) + (b2 === 1 ? 1 : 0);
  }

  stats.neighbors = neighbors;
  stats.countA = countA;
}

/**
 * Calculate the next state for a cell based on seed mode.
 */
export function calculateNextCellState(
  currentVal: number,
  mode: SeedMode,
  gameMode: GameMode,
  rng: () => number,
  probability: number,
): number {
  let nextVal = currentVal;

  switch (mode) {
    case 'set':
      nextVal = gameMode === 'Colony' ? (rng() < 0.5 ? 1 : 2) : 1;
      break;
    case 'clear':
      nextVal = 0;
      break;
    case 'toggle':
      nextVal = nextVal > 0 ? 0 : 1;
      break;
    case 'random':
      if (rng() < probability) {
        nextVal = gameMode === 'Colony' ? (rng() < 0.5 ? 1 : 2) : 1;
      } else {
        nextVal = 0;
      }
      break;
  }
  return nextVal;
}
