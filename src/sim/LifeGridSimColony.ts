import {
  applyCellUpdate,
  type ColonyStats,
  countNeighborsColony,
  type LifeGridStepContext,
} from './LifeGridHelper';
import { LifeGridSimBase } from './LifeGridSimBase';

function clampNeighbors(value: number): number {
  return value < 0 ? 0 : value > 8 ? 8 : value;
}

function resolveSpeciesNeighbors(
  rawNeighbors: number,
  baseBias: -1 | 0 | 1,
  affinity: -1 | 0 | 1,
  species: 1 | 2,
): number {
  if (affinity === 0) return clampNeighbors(rawNeighbors + baseBias);
  const combined = baseBias + (species === 1 ? affinity : -affinity);
  const clampedBias = combined < -1 ? -1 : combined > 1 ? 1 : combined;
  return clampNeighbors(rawNeighbors + clampedBias);
}

function resolveBirthCandidate(
  countA: number,
  countB: number,
  affinity: -1 | 0 | 1,
  la: number,
  lo: number,
  generation: number,
): 1 | 2 {
  if (countA > countB) return 1;
  if (countB > countA) return 2;
  if (affinity > 0) return 1;
  if (affinity < 0) return 2;
  return ((la + lo + generation) & 1) === 0 ? 1 : 2;
}

function stepColonyCell(
  ctx: LifeGridStepContext,
  stats: ColonyStats,
  la: number,
  rowOffset: number,
  rTop: number,
  rMid: number,
  rBot: number,
  hasTop: boolean,
  hasBot: boolean,
  left: number,
  lo: number,
  right: number,
  topShift: number,
  botShift: number,
): void {
  const {
    grid,
    lonCells: W,
    ecologyBias,
    ecologyAffinity,
    rules,
    generation,
    colonyBiomeAffinity,
  } = ctx;
  stats.neighbors = 0;
  stats.countA = 0;
  countNeighborsColony(
    grid,
    rTop,
    rMid,
    rBot,
    hasTop,
    hasBot,
    left,
    lo,
    right,
    stats,
    topShift,
    botShift,
    W,
  );

  const idx = rowOffset + lo;
  const current = grid[idx];
  const rawNeighbors = stats.neighbors;

  const baseBias = (ecologyBias === null ? 0 : ecologyBias[idx]) as -1 | 0 | 1;
  const affinity = (colonyBiomeAffinity && ecologyAffinity !== null ? ecologyAffinity[idx] : 0) as
    -1 | 0 | 1;

  let effectiveNeighbors: number;
  let nextVal = 0;

  if (current > 0) {
    const species: 1 | 2 = current === 1 ? 1 : 2;
    effectiveNeighbors = resolveSpeciesNeighbors(rawNeighbors, baseBias, affinity, species);
    if (rules.survive[effectiveNeighbors]) nextVal = species;
  } else {
    const countA = stats.countA;
    const countB = rawNeighbors - countA;
    const candidate = resolveBirthCandidate(countA, countB, affinity, la, lo, generation);
    effectiveNeighbors = resolveSpeciesNeighbors(rawNeighbors, baseBias, affinity, candidate);
    if (rules.birth[effectiveNeighbors]) nextVal = candidate;
  }

  applyCellUpdate(ctx, idx, current, nextVal, effectiveNeighbors);
}

const SCRATCH_COLONY_STATS: ColonyStats = { neighbors: 0, countA: 0 };

/**
 * Advance one generation on `ctx` using two-colony Game of Life rules.
 */
export function stepColonyGrid(ctx: LifeGridStepContext): void {
  const L = ctx.latCells;
  const W = ctx.lonCells;
  const centerEnd = W - 1;
  const stats = SCRATCH_COLONY_STATS;
  const polarWrap = ctx.polarWrap;
  const halfW = polarWrap ? Math.floor(W / 2) : 0;

  for (let la = 0; la < L; la++) {
    const rowOffset = la * W;
    const atTop = la === 0;
    const atBot = la === L - 1;

    const rTop = atTop ? 0 : (la - 1) * W;
    const rMid = rowOffset;
    const rBot = atBot ? (L - 1) * W : (la + 1) * W;
    const hasTop = !atTop || polarWrap;
    const hasBot = !atBot || polarWrap;
    const topShift = atTop && polarWrap ? halfW : 0;
    const botShift = atBot && polarWrap ? halfW : 0;

    stepColonyCell(
      ctx,
      stats,
      la,
      rowOffset,
      rTop,
      rMid,
      rBot,
      hasTop,
      hasBot,
      W - 1,
      0,
      1,
      topShift,
      botShift,
    );

    for (let lo = 1; lo < centerEnd; lo++) {
      stepColonyCell(
        ctx,
        stats,
        la,
        rowOffset,
        rTop,
        rMid,
        rBot,
        hasTop,
        hasBot,
        lo - 1,
        lo,
        lo + 1,
        topShift,
        botShift,
      );
    }

    stepColonyCell(
      ctx,
      stats,
      la,
      rowOffset,
      rTop,
      rMid,
      rBot,
      hasTop,
      hasBot,
      W - 2,
      W - 1,
      0,
      topShift,
      botShift,
    );
  }
}

export class LifeGridSimColony extends LifeGridSimBase {
  stepColony() {
    this.runStep(stepColonyGrid);
  }
}
