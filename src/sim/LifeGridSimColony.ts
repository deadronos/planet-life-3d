import { adjustNeighborsForEcology } from './ecology';
import {
  applyCellUpdate,
  type ColonyStats,
  countNeighborsColony,
  type LifeGridStepContext,
} from './LifeGridHelper';
import { LifeGridSimBase } from './LifeGridSimBase';

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
  const { grid, latCells: L, lonCells: W, ecologyProfile, rules } = ctx;
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
  const effectiveNeighbors = adjustNeighborsForEcology(
    stats.neighbors,
    la,
    lo,
    L,
    W,
    ecologyProfile,
  );
  let nextVal = 0;

  if (current > 0) {
    if (rules.survive[effectiveNeighbors]) nextVal = current;
  } else {
    if (rules.birth[effectiveNeighbors]) nextVal = stats.countA >= 2 ? 1 : 2;
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
