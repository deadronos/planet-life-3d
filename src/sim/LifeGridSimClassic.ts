import { adjustNeighborsForEcology } from './ecology';
import { sumNeighborsEdge } from './LifeGridHelper';
import { LifeGridSimBase } from './LifeGridSimBase';

export class LifeGridSimClassic extends LifeGridSimBase {
  stepClassic() {
    const L = this.latCells;
    const W = this.lonCells;
    const { birth, survive } = this.rules;
    const grid = this.grid;

    let birthMask = 0;
    let surviveMask = 0;
    for (let i = 0; i < 9; i++) {
      if (birth[i]) birthMask |= 1 << i;
      if (survive[i]) surviveMask |= 1 << i;
    }

    this.birthsLastTick = 0;
    this.deathsLastTick = 0;
    this.population = 0;
    this.nextAliveCount = 0;

    for (let la = 0; la < L; la++) {
      const rowOffset = la * W;

      const rTop = (la - 1) * W;
      const rMid = rowOffset;
      const rBot = (la + 1) * W;

      const hasTop = la > 0;
      const hasBot = la < L - 1;

      {
        const lo = 0;
        const left = W - 1;
        const right = 1;

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
        );
        const neighbors = adjustNeighborsForEcology(
          rawNeighbors,
          la,
          lo,
          L,
          W,
          this.ecologyProfile,
        );

        const idx = rowOffset + lo;
        const alive = grid[idx];
        const nextAlive = ((alive ? surviveMask : birthMask) >> neighbors) & 1;

        this.applyCellUpdate(idx, alive, nextAlive, neighbors);
      }

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
        const neighbors = adjustNeighborsForEcology(
          rawNeighbors,
          la,
          lo,
          L,
          W,
          this.ecologyProfile,
        );

        const idx = rowOffset + lo;
        const alive = grid[idx];
        const nextAlive = ((alive ? surviveMask : birthMask) >> neighbors) & 1;

        this.applyCellUpdate(idx, alive, nextAlive, neighbors);

        sLeft = sCurr;
        sCurr = sRight;
      }

      {
        const lo = W - 1;
        const left = W - 2;
        const right = 0;

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
        );
        const neighbors = adjustNeighborsForEcology(
          rawNeighbors,
          la,
          lo,
          L,
          W,
          this.ecologyProfile,
        );

        const idx = rowOffset + lo;
        const alive = grid[idx];
        const nextAlive = ((alive ? surviveMask : birthMask) >> neighbors) & 1;

        this.applyCellUpdate(idx, alive, nextAlive, neighbors);
      }
    }

    this.swapBuffers();
  }
}
