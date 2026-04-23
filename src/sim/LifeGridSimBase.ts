import { SIM_CONSTRAINTS, SIM_DEFAULTS } from './constants';
import type { EcologyProfileName } from './ecology';
import { calculateNextCellState } from './LifeGridHelper';
import type { Offset } from './patterns';
import type { Rules } from './rules';
import type { GameMode, SeedMode } from './types';
import { clampInt, safeInt } from './utils';

export class LifeGridSimBase {
  gameMode: GameMode = 'Classic';
  protected ecologyProfile: EcologyProfileName = 'None';
  readonly latCells: number;
  readonly lonCells: number;
  readonly cellCount: number;

  protected grid: Uint8Array;
  protected next: Uint8Array;
  protected age: Uint8Array;
  protected ageNext: Uint8Array;
  protected neighborHeat: Uint8Array;
  protected neighborHeatNext: Uint8Array;
  protected rules: Rules;

  protected aliveIndices: Int32Array;
  protected nextAliveIndices: Int32Array;
  protected aliveCount = 0;
  protected nextAliveCount = 0;

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

  setGameMode(mode: GameMode) {
    this.gameMode = mode;
  }

  setEcologyProfile(profile: EcologyProfileName) {
    this.ecologyProfile = profile;
  }

  protected coordsToIdx(lat: number, lon: number): number {
    const la = clampInt(lat, 0, this.latCells - 1);
    const lo = ((lon % this.lonCells) + this.lonCells) % this.lonCells;
    return la * this.lonCells + lo;
  }

  protected setCellState(idx: number, value: number) {
    this.grid[idx] = value;
    this.age[idx] = value > 0 ? 1 : 0;
    this.neighborHeat[idx] = 0;
  }

  getCell(lat: number, lon: number): number {
    return this.grid[this.coordsToIdx(lat, lon)];
  }

  setCell(lat: number, lon: number, value: number) {
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
    const isColony = this.gameMode === 'Colony';
    for (let i = 0; i < this.cellCount; i++) {
      let alive = 0;
      if (rng() < p) {
        alive = isColony ? (rng() < 0.5 ? 1 : 2) : 1;
      }
      this.setCellState(i, alive);
    }
    this.rebuildAliveIndices();
    this.birthsLastTick = 0;
    this.deathsLastTick = 0;
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
      const currentVal = this.grid[idx];
      const nextVal = calculateNextCellState(currentVal, params.mode, this.gameMode, rng, p);
      this.setCellState(idx, nextVal);
    }

    this.rebuildAliveIndices();
  }

  protected rebuildAliveIndices() {
    let pop = 0;
    this.aliveCount = 0;
    for (let i = 0; i < this.cellCount; i++) {
      if (this.grid[i] > 0) {
        pop++;
        this.aliveIndices[this.aliveCount++] = i;
      }
    }
    this.population = pop;
  }

  forEachAlive(fn: (idx: number) => void) {
    const count = this.aliveCount;
    const indices = this.aliveIndices;
    for (let i = 0; i < count; i++) {
      fn(indices[i]);
    }
  }

  getGridView(): Uint8Array {
    return this.grid;
  }

  getAgeView(): Uint8Array {
    return this.age;
  }

  getNeighborHeatView(): Uint8Array {
    return this.neighborHeat;
  }

  getAliveIndicesView(): Int32Array {
    return this.aliveIndices;
  }

  getAliveCount(): number {
    return this.aliveCount;
  }

  protected applyCellUpdate(idx: number, currentVal: number, nextVal: number, neighbors: number) {
    if (nextVal > 0 && currentVal === 0) this.birthsLastTick++;
    if (currentVal > 0 && nextVal === 0) this.deathsLastTick++;
    if (nextVal > 0) this.population++;

    this.next[idx] = nextVal;
    this.ageNext[idx] = nextVal > 0 ? Math.min(255, this.age[idx] + 1) : 0;
    this.neighborHeatNext[idx] = nextVal > 0 ? neighbors : 0;
    if (nextVal > 0) this.nextAliveIndices[this.nextAliveCount++] = idx;
  }

  protected swapBuffers() {
    this.generation++;

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
}
