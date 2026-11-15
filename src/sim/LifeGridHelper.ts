import type { EcologyProfileName } from './ecology';
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
  readonly ecologyProfile: EcologyProfileName;
  birthsLastTick: number;
  deathsLastTick: number;
  population: number;
  colonyAPopulation: number;
  colonyBPopulation: number;
  nextAliveCount: number;
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
 * Sum neighbors for Classic mode (values are 0 or 1).
 * Specifically for edge cases where we can't use the sliding window optimization.
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
): number {
  let neighbors = 0;
  if (hasTop) {
    neighbors += grid[rTop + left] + grid[rTop + lo] + grid[rTop + right];
  }
  neighbors += grid[rMid + left] + grid[rMid + right];
  if (hasBot) {
    neighbors += grid[rBot + left] + grid[rBot + lo] + grid[rBot + right];
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
): void {
  let neighbors = 0;
  let countA = 0;

  if (hasTop) {
    const t0 = grid[rTop + left];
    const t1 = grid[rTop + lo];
    const t2 = grid[rTop + right];
    neighbors += (t0 > 0 ? 1 : 0) + (t1 > 0 ? 1 : 0) + (t2 > 0 ? 1 : 0);
    countA += (t0 === 1 ? 1 : 0) + (t1 === 1 ? 1 : 0) + (t2 === 1 ? 1 : 0);
  }

  const m0 = grid[rMid + left];
  const m2 = grid[rMid + right];
  neighbors += (m0 > 0 ? 1 : 0) + (m2 > 0 ? 1 : 0);
  countA += (m0 === 1 ? 1 : 0) + (m2 === 1 ? 1 : 0);

  if (hasBot) {
    const b0 = grid[rBot + left];
    const b1 = grid[rBot + lo];
    const b2 = grid[rBot + right];
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
