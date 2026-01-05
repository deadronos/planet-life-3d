import type { GameMode, SeedMode } from './LifeSimBase';

export type ColonyStats = {
  neighbors: number;
  countA: number;
};

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
  // Inline-like checks for performance
  if (hasTop) {
    let v = grid[rTop + left];
    if (v) {
      stats.neighbors++;
      if (v === 1) stats.countA++;
    }
    v = grid[rTop + lo];
    if (v) {
      stats.neighbors++;
      if (v === 1) stats.countA++;
    }
    v = grid[rTop + right];
    if (v) {
      stats.neighbors++;
      if (v === 1) stats.countA++;
    }
  }

  let v = grid[rMid + left];
  if (v) {
    stats.neighbors++;
    if (v === 1) stats.countA++;
  }
  v = grid[rMid + right];
  if (v) {
    stats.neighbors++;
    if (v === 1) stats.countA++;
  }

  if (hasBot) {
    v = grid[rBot + left];
    if (v) {
      stats.neighbors++;
      if (v === 1) stats.countA++;
    }
    v = grid[rBot + lo];
    if (v) {
      stats.neighbors++;
      if (v === 1) stats.countA++;
    }
    v = grid[rBot + right];
    if (v) {
      stats.neighbors++;
      if (v === 1) stats.countA++;
    }
  }
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
