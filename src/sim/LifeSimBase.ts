import { SIM_CONSTRAINTS, SIM_DEFAULTS } from './constants';
import type { Offset } from './patterns';
import type { Rules } from './rules';
import { clampInt, safeInt } from './utils';

export type SeedMode = 'set' | 'toggle' | 'clear' | 'random';

export class LifeSimBase {
  readonly latCells: number;
  readonly lonCells: number;
  readonly cellCount: number;

  // Protected state (accessible by subclasses)
  protected grid: Uint8Array;
  protected next: Uint8Array;
  protected age: Uint8Array;
  protected ageNext: Uint8Array;
  protected neighborHeat: Uint8Array;
  protected neighborHeatNext: Uint8Array;
  protected rules: Rules;

  // Optimizations
  protected aliveIndices: Int32Array;
  protected nextAliveIndices: Int32Array;
  protected aliveCount = 0;
  protected nextAliveCount = 0;

  // Stats
  generation = 0;
  population = 0;
  birthsLastTick = 0;
  deathsLastTick = 0;

  constructor(opts: { latCells: number; lonCells: number; rules: Rules }) {
    this.latCells = safeInt(
      opts.latCells,
      SIM_DEFAULTS.latCells,
      SIM_CONSTRAINTS.latCells.min,
      SIM_CONSTRAINTS.latCells.max,
    );
    this.lonCells = safeInt(
      opts.lonCells,
      SIM_DEFAULTS.lonCells,
      SIM_CONSTRAINTS.lonCells.min,
      SIM_CONSTRAINTS.lonCells.max,
    );
    this.cellCount = this.latCells * this.lonCells;

    this.grid = new Uint8Array(this.cellCount);
    this.next = new Uint8Array(this.cellCount);
    this.age = new Uint8Array(this.cellCount);
    this.ageNext = new Uint8Array(this.cellCount);
    this.neighborHeat = new Uint8Array(this.cellCount);
    this.neighborHeatNext = new Uint8Array(this.cellCount);

    this.aliveIndices = new Int32Array(this.cellCount);
    this.nextAliveIndices = new Int32Array(this.cellCount);

    this.rules = opts.rules;
  }

  setRules(rules: Rules) {
    this.rules = rules;
  }

  protected coordsToIdx(lat: number, lon: number): number {
    const la = clampInt(lat, 0, this.latCells - 1);
    const lo = ((lon % this.lonCells) + this.lonCells) % this.lonCells;
    return la * this.lonCells + lo;
  }

  protected setCellState(idx: number, value: 0 | 1) {
    this.grid[idx] = value;
    this.age[idx] = value ? 1 : 0;
    this.neighborHeat[idx] = 0;
  }

  getCell(lat: number, lon: number): 0 | 1 {
    return this.grid[this.coordsToIdx(lat, lon)] as 0 | 1;
  }

  setCell(lat: number, lon: number, value: 0 | 1) {
    this.setCellState(this.coordsToIdx(lat, lon), value);
  }

  clear() {
    this.grid.fill(0);
    this.next.fill(0);
    this.age.fill(0);
    this.ageNext.fill(0);
    this.neighborHeat.fill(0);
    this.neighborHeatNext.fill(0);
    this.aliveCount = 0;
    this.nextAliveCount = 0;
    this.population = 0;
    this.birthsLastTick = 0;
    this.deathsLastTick = 0;
    this.generation = 0;
  }

  randomize(density: number, rng = Math.random) {
    const p = Math.max(0, Math.min(1, density));
    for (let i = 0; i < this.cellCount; i++) {
      const alive = rng() < p ? 1 : 0;
      this.setCellState(i, alive);
    }
    // Recompute stats after randomizing
    this.rebuildAliveIndices();
    this.birthsLastTick = 0;
    this.deathsLastTick = 0;
  }

  /**
   * Single simulation tick.
   * Optimized loop from LifeSphereSim handling safe zones to avoid modulo operations.
   */
  step() {
    const L = this.latCells;
    const W = this.lonCells;
    const { birth, survive } = this.rules;
    const grid = this.grid;

    // Convert rules to bitmasks for faster lookup
    let birthMask = 0;
    let surviveMask = 0;
    for (let i = 0; i < 9; i++) {
      if (birth[i]) birthMask |= 1 << i;
      if (survive[i]) surviveMask |= 1 << i;
    }

    let births = 0;
    let deaths = 0;
    let pop = 0;
    this.nextAliveCount = 0;

    for (let la = 0; la < L; la++) {
      const rowOffset = la * W;

      // Pre-calculate neighbor row indices
      const rTop = (la - 1) * W;
      const rMid = rowOffset;
      const rBot = (la + 1) * W;

      const hasTop = la > 0;
      const hasBot = la < L - 1;

      // 1. Left Edge (lo = 0)
      {
        const lo = 0;
        let neighbors = 0;
        const left = W - 1;
        const right = 1;

        if (hasTop) {
          neighbors += grid[rTop + left] + grid[rTop + lo] + grid[rTop + right];
        }
        neighbors += grid[rMid + left] + grid[rMid + right];
        if (hasBot) {
          neighbors += grid[rBot + left] + grid[rBot + lo] + grid[rBot + right];
        }

        const idx = rowOffset + lo;
        const alive = grid[idx];
        const nextAlive = ((alive ? surviveMask : birthMask) >> neighbors) & 1;

        if (nextAlive > alive) births++;
        if (alive > nextAlive) deaths++;
        if (nextAlive) pop++;

        this.next[idx] = nextAlive;
        this.ageNext[idx] = nextAlive ? Math.min(255, this.age[idx] + 1) : 0;
        this.neighborHeatNext[idx] = nextAlive ? neighbors : 0;
        if (nextAlive) this.nextAliveIndices[this.nextAliveCount++] = idx;
      }

      // 2. Safe Center (lo = 1 .. W - 2)
      const centerEnd = W - 1;
      for (let lo = 1; lo < centerEnd; lo++) {
        let neighbors = 0;

        if (hasTop) {
          neighbors += grid[rTop + lo - 1] + grid[rTop + lo] + grid[rTop + lo + 1];
        }
        neighbors += grid[rMid + lo - 1] + grid[rMid + lo + 1];
        if (hasBot) {
          neighbors += grid[rBot + lo - 1] + grid[rBot + lo] + grid[rBot + lo + 1];
        }

        const idx = rowOffset + lo;
        const alive = grid[idx];
        const nextAlive = ((alive ? surviveMask : birthMask) >> neighbors) & 1;

        if (nextAlive > alive) births++;
        if (alive > nextAlive) deaths++;
        if (nextAlive) pop++;

        this.next[idx] = nextAlive;
        this.ageNext[idx] = nextAlive ? Math.min(255, this.age[idx] + 1) : 0;
        this.neighborHeatNext[idx] = nextAlive ? neighbors : 0;
        if (nextAlive) this.nextAliveIndices[this.nextAliveCount++] = idx;
      }

      // 3. Right Edge (lo = W - 1)
      {
        const lo = W - 1;
        let neighbors = 0;
        const left = W - 2;
        const right = 0;

        if (hasTop) {
          neighbors += grid[rTop + left] + grid[rTop + lo] + grid[rTop + right];
        }
        neighbors += grid[rMid + left] + grid[rMid + right];
        if (hasBot) {
          neighbors += grid[rBot + left] + grid[rBot + lo] + grid[rBot + right];
        }

        const idx = rowOffset + lo;
        const alive = grid[idx];
        const nextAlive = ((alive ? surviveMask : birthMask) >> neighbors) & 1;

        if (nextAlive > alive) births++;
        if (alive > nextAlive) deaths++;
        if (nextAlive) pop++;

        this.next[idx] = nextAlive;
        this.ageNext[idx] = nextAlive ? Math.min(255, this.age[idx] + 1) : 0;
        this.neighborHeatNext[idx] = nextAlive ? neighbors : 0;
        if (nextAlive) this.nextAliveIndices[this.nextAliveCount++] = idx;
      }
    }

    this.birthsLastTick = births;
    this.deathsLastTick = deaths;
    this.population = pop;
    this.generation++;

    // swap
    let tmp = this.grid;
    this.grid = this.next;
    this.next = tmp;

    tmp = this.age;
    this.age = this.ageNext;
    this.ageNext = tmp;

    tmp = this.neighborHeat;
    this.neighborHeat = this.neighborHeatNext;
    this.neighborHeatNext = tmp;

    const tmpIdx = this.aliveIndices;
    this.aliveIndices = this.nextAliveIndices;
    this.nextAliveIndices = tmpIdx;
    this.aliveCount = this.nextAliveCount;
  }

  seedAtCell(params: {
    lat: number;
    lon: number;
    offsets: Offset[];
    mode: SeedMode;
    scale: number;
    jitter: number;
    probability: number;
    rng?: () => number;
    debug?: boolean;
  }) {
    const rng = params.rng ?? Math.random;
    const scale = Math.max(1, Math.floor(params.scale));
    const jitter = Math.max(0, Math.floor(params.jitter));
    const p = Math.max(0, Math.min(1, params.probability));

    if (params.debug) {
      // eslint-disable-next-line no-console
      console.log(
        `[LifeSimBase] seedAtCell: mode=${params.mode} offsets=${params.offsets.length} scale=${scale} p=${p} jitter=${jitter}`,
      );
    }

    for (const [dLa0, dLo0] of params.offsets) {
      let dLa = dLa0 * scale;
      let dLo = dLo0 * scale;

      if (jitter > 0) {
        dLa += Math.floor((rng() * 2 - 1) * jitter);
        dLo += Math.floor((rng() * 2 - 1) * jitter);
      }

      const idx = this.coordsToIdx(params.lat + dLa, params.lon + dLo);
      let nextVal: 0 | 1 = this.grid[idx] as 0 | 1;

      switch (params.mode) {
        case 'set':
          nextVal = 1;
          break;
        case 'clear':
          nextVal = 0;
          break;
        case 'toggle':
          nextVal = nextVal ? 0 : 1;
          break;
        case 'random':
          nextVal = rng() < p ? 1 : 0;
          break;
      }
      this.setCellState(idx, nextVal);
    }

    // We should recompute stats if we are modifying the grid outside of step()
    this.rebuildAliveIndices();
  }

  protected rebuildAliveIndices() {
    let pop = 0;
    this.aliveCount = 0;
    for (let i = 0; i < this.cellCount; i++) {
      if (this.grid[i] === 1) {
        pop++;
        this.aliveIndices[this.aliveCount++] = i;
      }
    }
    this.population = pop;
  }

  /** Iterate alive cells (for rendering) */
  forEachAlive(fn: (idx: number) => void) {
    const count = this.aliveCount;
    const indices = this.aliveIndices;
    for (let i = 0; i < count; i++) {
      fn(indices[i]);
    }
  }

  /** Read-only view of the grid (0/1 per cell). Useful for texture-based rendering. */
  getGridView(): Uint8Array {
    return this.grid;
  }

  /** Read-only view of ages (frames alive, clamped to 255) */
  getAgeView(): Uint8Array {
    return this.age;
  }

  /** Read-only view of neighbor counts for alive cells (0..8) */
  getNeighborHeatView(): Uint8Array {
    return this.neighborHeat;
  }
}
