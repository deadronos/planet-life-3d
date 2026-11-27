import {
  applyCellUpdate,
  applyEcologyBias,
  type LifeGridStepContext,
  shiftLon,
  sumNeighborsEdge,
} from './LifeGridHelper';
import { LifeGridSimBase } from './LifeGridSimBase';
import { normalizeDecayStates } from './rules';

function sumFiringNeighborsEdge(
  grid: Uint8Array,
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
  lonCells: number,
): number {
  let neighbors = 0;
  if (hasTop) {
    if (grid[rTop + shiftLon(left, topShift, lonCells)] === 1) neighbors++;
    if (grid[rTop + shiftLon(lo, topShift, lonCells)] === 1) neighbors++;
    if (grid[rTop + shiftLon(right, topShift, lonCells)] === 1) neighbors++;
  }
  if (grid[rMid + left] === 1) neighbors++;
  if (grid[rMid + right] === 1) neighbors++;
  if (hasBot) {
    if (grid[rBot + shiftLon(left, botShift, lonCells)] === 1) neighbors++;
    if (grid[rBot + shiftLon(lo, botShift, lonCells)] === 1) neighbors++;
    if (grid[rBot + shiftLon(right, botShift, lonCells)] === 1) neighbors++;
  }
  return neighbors;
}

function nextGenerationsState(
  current: number,
  neighbors: number,
  birthMask: number,
  surviveMask: number,
  decayStates: number,
): number {
  if (current === 0) {
    return (birthMask >> neighbors) & 1;
  }
  if (current === 1) {
    return ((surviveMask >> neighbors) & 1) !== 0 ? 1 : 2;
  }
  const nextS = current + 1;
  return nextS >= decayStates ? 0 : nextS;
}

function stepGenerationsEdgeCell(
  ctx: LifeGridStepContext,
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
  decayStates: number,
  topShift: number,
  botShift: number,
): void {
  const { grid, lonCells: W, ecologyBias } = ctx;
  const rawNeighbors = sumFiringNeighborsEdge(
    grid,
    rTop,
    rMid,
    rBot,
    hasTop,
    hasBot,
    left,
    lo,
    right,
    topShift,
    botShift,
    W,
  );
  const idx = rowOffset + lo;
  const neighbors = applyEcologyBias(rawNeighbors, idx, ecologyBias);

  const current = grid[idx];
  const nextVal = nextGenerationsState(current, neighbors, birthMask, surviveMask, decayStates);

  applyCellUpdate(ctx, idx, current, nextVal, neighbors);
}

function stepGenerationsGrid(
  ctx: LifeGridStepContext,
  birthMask: number,
  surviveMask: number,
  decayStates: number,
): void {
  const L = ctx.latCells;
  const W = ctx.lonCells;
  const grid = ctx.grid;
  const ecologyBias = ctx.ecologyBias;
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

    stepGenerationsEdgeCell(
      ctx,
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
      decayStates,
      topShift,
      botShift,
    );

    const centerEnd = W - 1;

    if (topShift === 0 && botShift === 0) {
      let sLeft = grid[rMid] === 1 ? 1 : 0;
      if (hasTop && grid[rTop] === 1) sLeft++;
      if (hasBot && grid[rBot] === 1) sLeft++;

      let sCurr = grid[rMid + 1] === 1 ? 1 : 0;
      if (hasTop && grid[rTop + 1] === 1) sCurr++;
      if (hasBot && grid[rBot + 1] === 1) sCurr++;

      for (let lo = 1; lo < centerEnd; lo++) {
        const nextCol = lo + 1;
        let sRight = grid[rMid + nextCol] === 1 ? 1 : 0;
        if (hasTop && grid[rTop + nextCol] === 1) sRight++;
        if (hasBot && grid[rBot + nextCol] === 1) sRight++;

        const centerFiring = grid[rMid + lo] === 1 ? 1 : 0;
        const rawNeighbors = sLeft + sCurr + sRight - centerFiring;
        const idx = rowOffset + lo;
        const neighbors = applyEcologyBias(rawNeighbors, idx, ecologyBias);

        const current = grid[idx];
        const nextVal = nextGenerationsState(
          current,
          neighbors,
          birthMask,
          surviveMask,
          decayStates,
        );

        applyCellUpdate(ctx, idx, current, nextVal, neighbors);

        sLeft = sCurr;
        sCurr = sRight;
      }
    } else {
      for (let lo = 1; lo < centerEnd; lo++) {
        stepGenerationsEdgeCell(
          ctx,
          rowOffset,
          rTop,
          rMid,
          rBot,
          hasTop,
          hasBot,
          lo - 1,
          lo,
          lo + 1,
          birthMask,
          surviveMask,
          decayStates,
          topShift,
          botShift,
        );
      }
    }

    stepGenerationsEdgeCell(
      ctx,
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
      decayStates,
      topShift,
      botShift,
    );
  }
}

function stepClassicEdgeCell(
  ctx: LifeGridStepContext,
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
  topShift: number,
  botShift: number,
): void {
  const { grid, lonCells: W, ecologyBias } = ctx;
  const rawNeighbors = sumNeighborsEdge(
    grid,
    rTop,
    rMid,
    rBot,
    hasTop,
    hasBot,
    left,
    lo,
    right,
    topShift,
    botShift,
    W,
  );
  const idx = rowOffset + lo;
  const neighbors = applyEcologyBias(rawNeighbors, idx, ecologyBias);

  const alive = grid[idx];
  const nextAlive = ((alive ? surviveMask : birthMask) >> neighbors) & 1;

  applyCellUpdate(ctx, idx, alive, nextAlive, neighbors);
}

/**
 * Advance one generation on `ctx` using Classic single-species Game of Life
 * (or multi-state Generations when `decayStates > 2`).
 */
export function stepClassicGrid(ctx: LifeGridStepContext): void {
  const L = ctx.latCells;
  const W = ctx.lonCells;
  const { birth, survive } = ctx.rules;
  const decayStates = normalizeDecayStates(ctx.rules.decayStates);
  const grid = ctx.grid;
  const ecologyBias = ctx.ecologyBias;
  const polarWrap = ctx.polarWrap;
  const halfW = polarWrap ? Math.floor(W / 2) : 0;

  let birthMask = 0;
  let surviveMask = 0;
  for (let i = 0; i < 9; i++) {
    if (birth[i]) birthMask |= 1 << i;
    if (survive[i]) surviveMask |= 1 << i;
  }

  if (decayStates > 2) {
    stepGenerationsGrid(ctx, birthMask, surviveMask, decayStates);
    return;
  }

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

    stepClassicEdgeCell(
      ctx,
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
      topShift,
      botShift,
    );

    const centerEnd = W - 1;

    if (topShift === 0 && botShift === 0) {
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
        const idx = rowOffset + lo;
        const neighbors = applyEcologyBias(rawNeighbors, idx, ecologyBias);

        const alive = grid[idx];
        const nextAlive = ((alive ? surviveMask : birthMask) >> neighbors) & 1;

        applyCellUpdate(ctx, idx, alive, nextAlive, neighbors);

        sLeft = sCurr;
        sCurr = sRight;
      }
    } else {
      for (let lo = 1; lo < centerEnd; lo++) {
        stepClassicEdgeCell(
          ctx,
          rowOffset,
          rTop,
          rMid,
          rBot,
          hasTop,
          hasBot,
          lo - 1,
          lo,
          lo + 1,
          birthMask,
          surviveMask,
          topShift,
          botShift,
        );
      }
    }

    stepClassicEdgeCell(
      ctx,
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
      topShift,
      botShift,
    );
  }
}

export class LifeGridSimClassic extends LifeGridSimBase {
  stepClassic() {
    this.runStep(stepClassicGrid);
  }
}
