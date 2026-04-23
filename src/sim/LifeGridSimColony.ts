import { adjustNeighborsForEcology } from './ecology';
import { countNeighborsColony } from './LifeGridHelper';
import { LifeGridSimBase } from './LifeGridSimBase';

export class LifeGridSimColony extends LifeGridSimBase {
  stepColony() {
    const L = this.latCells;
    const W = this.lonCells;
    const grid = this.grid;

    this.birthsLastTick = 0;
    this.deathsLastTick = 0;
    this.population = 0;
    this.nextAliveCount = 0;

    const process = (
      lo: number,
      la: number,
      neighbors: number,
      countA: number,
      rowOffset: number,
    ) => {
      const idx = rowOffset + lo;
      const current = grid[idx];
      const effectiveNeighbors = adjustNeighborsForEcology(
        neighbors,
        la,
        lo,
        L,
        W,
        this.ecologyProfile,
      );
      let nextVal = 0;

      if (current > 0) {
        if (effectiveNeighbors === 2 || effectiveNeighbors === 3) nextVal = current;
      } else {
        if (effectiveNeighbors === 3) nextVal = countA >= 2 ? 1 : 2;
      }

      this.applyCellUpdate(idx, current, nextVal, effectiveNeighbors);
    };

    for (let la = 0; la < L; la++) {
      const rowOffset = la * W;
      const rTop = (la - 1) * W;
      const rMid = rowOffset;
      const rBot = (la + 1) * W;
      const hasTop = la > 0;
      const hasBot = la < L - 1;

      {
        const lo = 0;
        const stats = { neighbors: 0, countA: 0 };
        const left = W - 1;
        const right = 1;

        countNeighborsColony(grid, rTop, rMid, rBot, hasTop, hasBot, left, lo, right, stats);

        process(lo, la, stats.neighbors, stats.countA, rowOffset);
      }

      const centerEnd = W - 1;
      for (let lo = 1; lo < centerEnd; lo++) {
        const stats = { neighbors: 0, countA: 0 };
        countNeighborsColony(grid, rTop, rMid, rBot, hasTop, hasBot, lo - 1, lo, lo + 1, stats);

        process(lo, la, stats.neighbors, stats.countA, rowOffset);
      }

      {
        const lo = W - 1;
        const stats = { neighbors: 0, countA: 0 };
        const left = W - 2;
        const right = 0;

        countNeighborsColony(grid, rTop, rMid, rBot, hasTop, hasBot, left, lo, right, stats);

        process(lo, la, stats.neighbors, stats.countA, rowOffset);
      }
    }

    this.swapBuffers();
  }
}
