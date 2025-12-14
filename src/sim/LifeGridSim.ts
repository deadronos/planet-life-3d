import { SIM_CONSTRAINTS, SIM_DEFAULTS } from './constants';
import type { Offset } from './patterns';
import type { Rules } from './rules';
import { clampInt, safeInt } from './utils';

export type SeedMode = 'set' | 'toggle' | 'clear' | 'random';

/**
 * Pure simulation core (typed arrays only).
 *
 * Notes:
 * - No three.js dependency (safe to run in a Web Worker).
 * - Latitude is clamped at poles; longitude wraps.
 */
export class LifeGridSim {
  readonly latCells: number;
  readonly lonCells: number;
  readonly cellCount: number;

  private grid: Uint8Array;
  private next: Uint8Array;
  private age: Uint8Array;
  private ageNext: Uint8Array;
  private neighborHeat: Uint8Array;
  private neighborHeatNext: Uint8Array;
  private rules: Rules;

  // Stats
  generation = 0;
  population = 0;
  birthsLastTick = 0;
  deathsLastTick = 0;

  constructor(opts: { latCells: number; lonCells: number; rules: Rules }) {
    // Defensive: callers may temporarily supply NaN/undefined.
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
    this.rules = opts.rules;
  }

  setRules(rules: Rules) {
    this.rules = rules;
  }

  private coordsToIdx(lat: number, lon: number): number {
    const la = clampInt(lat, 0, this.latCells - 1);
    const lo = ((lon % this.lonCells) + this.lonCells) % this.lonCells;
    return la * this.lonCells + lo;
  }

  private setCellState(idx: number, value: 0 | 1) {
    this.grid[idx] = value;
    this.age[idx] = value ? 1 : 0;
    this.neighborHeat[idx] = 0;
  }

  private recomputeStatsFromGrid() {
    let pop = 0;

    for (let i = 0; i < this.cellCount; i++) {
      if (this.grid[i] === 1) pop++;
    }

    this.population = pop;
    this.birthsLastTick = 0;
    this.deathsLastTick = 0;
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
    this.population = 0;
    this.birthsLastTick = 0;
    this.deathsLastTick = 0;
  }

  randomize(density: number, rng = Math.random) {
    const p = Math.max(0, Math.min(1, density));
    for (let i = 0; i < this.cellCount; i++) {
      const alive = rng() < p ? 1 : 0;
      this.setCellState(i, alive);
    }

    this.recomputeStatsFromGrid();
  }

  /** Single simulation tick */
  step() {
    const L = this.latCells;
    const W = this.lonCells;
    const { birth, survive } = this.rules;

    let births = 0;
    let deaths = 0;
    let pop = 0;

    for (let la = 0; la < L; la++) {
      const row = la * W;
      for (let lo = 0; lo < W; lo++) {
        let neighbors = 0;
        for (let dLa = -1; dLa <= 1; dLa++) {
          const nla = la + dLa;
          if (nla < 0 || nla >= L) continue;
          const nrow = nla * W;
          for (let dLo = -1; dLo <= 1; dLo++) {
            if (dLa === 0 && dLo === 0) continue;
            const nlo = (lo + dLo + W) % W;
            neighbors += this.grid[nrow + nlo];
          }
        }

        const idx = row + lo;
        const alive = this.grid[idx] === 1;
        const nextAlive = alive ? (survive[neighbors] ? 1 : 0) : birth[neighbors] ? 1 : 0;

        if (!alive && nextAlive) births++;
        if (alive && !nextAlive) deaths++;
        if (nextAlive) pop++;

        this.next[idx] = nextAlive;
        this.ageNext[idx] = nextAlive ? Math.min(255, (alive ? this.age[idx] : 0) + 1) : 0;
        this.neighborHeatNext[idx] = nextAlive ? neighbors : 0;
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
        `[LifeGridSim] seedAtCell: mode=${params.mode} offsets=${params.offsets.length} scale=${scale} p=${p} jitter=${jitter}`,
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

    this.recomputeStatsFromGrid();
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
