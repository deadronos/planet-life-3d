import { adjustNeighborsForEcology } from './ecology';
import { applyCellUpdate, type LifeGridStepContext, sumNeighborsEdge } from './LifeGridHelper';
import { LifeGridSimBase } from './LifeGridSimBase';

function stepClassicEdgeCell(
  ctx: LifeGridStepContext,
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
  birthMask: number,
  surviveMask: number,
): void {
  const { grid, latCells: L, lonCells: W, ecologyProfile } = ctx;
  const rawNeighbors = sumNeighborsEdge(grid, rTop, rMid, rBot, hasTop, hasBot, left, lo, right);
  const neighbors = adjustNeighborsForEcology(rawNeighbors, la, lo, L, W, ecologyProfile);

  const idx = rowOffset + lo;
  const alive = grid[idx];
  const nextAlive = ((alive ? surviveMask : birthMask) >> neighbors) & 1;

  applyCellUpdate(ctx, idx, alive, nextAlive, neighbors);
}

/**
 * Advance one generation on `ctx` using Classic single-species Game of Life rules.
 */
export function stepClassicGrid(ctx: LifeGridStepContext): void {
  const L = ctx.latCells;
  const W = ctx.lonCells;
  const { birth, survive } = ctx.rules;
  const grid = ctx.grid;
  const ecologyProfile = ctx.ecologyProfile;

  let birthMask = 0;
  let surviveMask = 0;
  for (let i = 0; i < 9; i++) {
    if (birth[i]) birthMask |= 1 << i;
    if (survive[i]) surviveMask |= 1 << i;
  }

  for (let la = 0; la < L; la++) {
    const rowOffset = la * W;

    const rTop = (la - 1) * W;
    const rMid = rowOffset;
    const rBot = (la + 1) * W;

    const hasTop = la > 0;
    const hasBot = la < L - 1;

    stepClassicEdgeCell(
      ctx,
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
      birthMask,
      surviveMask,
    );

    const centerEnd = W - 1;

    let sLeft = grid[rMid];
    if (hasTop) sLeft += grid[rTop];
    if (hasBot) sLeft += grid[rBot];

    let sCurr = grid[rMid + 1];
    if (hasTop) sCurr += grid[rTop + 1];
    if (hasBot) sCurr += grid[rBot + 1];

    for (let lo = 1; lo < centerEnd; lo++) {
      const nextCol = lo + 1;
      let sRight = grid[rMid + nextCol];
      if (hasTop) sRight += grid[rTop + nextCol];
      if (hasBot) sRight += grid[rBot + nextCol];

      const rawNeighbors = sLeft + sCurr + sRight - grid[rMid + lo];
      const neighbors = adjustNeighborsForEcology(rawNeighbors, la, lo, L, W, ecologyProfile);

      const idx = rowOffset + lo;
      const alive = grid[idx];
      const nextAlive = ((alive ? surviveMask : birthMask) >> neighbors) & 1;

      applyCellUpdate(ctx, idx, alive, nextAlive, neighbors);

      sLeft = sCurr;
      sCurr = sRight;
    }

    stepClassicEdgeCell(
      ctx,
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
      birthMask,
      surviveMask,
    );
  }
}

export class LifeGridSimClassic extends LifeGridSimBase {
  stepClassic() {
    this.runStep(stepClassicGrid);
  }
}
