import { SIM_CONSTRAINTS, SIM_DEFAULTS } from './constants';
import {
  advanceSolarPhase,
  buildEcologyTables,
  ECOLOGY_PROFILES,
  type EcologyProfileName,
  SOIL_MAX,
  SOIL_MIN,
  SOIL_NEUTRAL,
} from './ecology';
import { calculateNextCellState, type LifeGridStepContext } from './LifeGridHelper';
import { type Offset, transformOffsets } from './patterns';
import { normalizeDecayStates, type Rules } from './rules';
import type { GameMode, SeedMode } from './types';
import { clampInt, safeInt } from './utils';

export class LifeGridSimBase {
  gameMode: GameMode = 'Classic';
  polarWrap = false;
  protected ecologyProfile: EcologyProfileName = 'None';
  protected ecologyBias: Int8Array | null = null;
  protected ecologyAffinity: Int8Array | null = null;
  protected colonyBiomeAffinity = false;
  protected solarCycleSpeed = 0;
  protected solarPhase = 0;
  protected dynamicFertility = false;
  readonly latCells: number;
  readonly lonCells: number;
  readonly cellCount: number;

  protected grid: Uint8Array;
  protected next: Uint8Array;
  protected age: Uint8Array;
  protected ageNext: Uint8Array;
  protected neighborHeat: Uint8Array;
  protected neighborHeatNext: Uint8Array;
  protected soil: Uint8Array;
  protected soilNext: Uint8Array;
  protected rules: Rules;

  protected aliveIndices: Int32Array;
  protected nextAliveIndices: Int32Array;
  protected aliveCount = 0;
  protected nextAliveCount = 0;

  generation = 0;
  population = 0;
  colonyAPopulation = 0;
  colonyBPopulation = 0;
  birthsLastTick = 0;
  deathsLastTick = 0;

  constructor(opts: { latCells: number; lonCells: number; rules: Rules; polarWrap?: boolean }) {
    this.polarWrap = Boolean(opts.polarWrap);
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
    this.soil = new Uint8Array(this.cellCount);
    this.soilNext = new Uint8Array(this.cellCount);
    this.soil.fill(SOIL_NEUTRAL);
    this.soilNext.fill(SOIL_NEUTRAL);

    this.aliveIndices = new Int32Array(this.cellCount);
    this.nextAliveIndices = new Int32Array(this.cellCount);

    this.rules = opts.rules;
  }

  setRules(rules: Rules) {
    this.rules = rules;
    if (this.gameMode === 'Classic') {
      const maxState = normalizeDecayStates(rules.decayStates);
      let changed = false;
      for (let i = 0; i < this.cellCount; i++) {
        if (this.grid[i] >= maxState) {
          this.grid[i] = 0;
          this.age[i] = 0;
          this.neighborHeat[i] = 0;
          changed = true;
        }
      }
      if (changed) {
        this.rebuildAliveIndices();
      }
    }
  }

  setGameMode(mode: GameMode) {
    const prevMode = this.gameMode;
    this.gameMode = mode;
    if (mode === 'Classic' && prevMode !== 'Classic') {
      // Normalize Colony B (2) cells to Classic alive (1) so Classic neighbor
      // sums don't double-count Colony B cells.
      for (let i = 0; i < this.cellCount; i++) {
        if (this.grid[i] > 1) this.grid[i] = 1;
      }
    } else if (mode === 'Colony' && prevMode !== 'Colony') {
      // Normalize any Generations refractory states (> 2) to Colony B (2).
      for (let i = 0; i < this.cellCount; i++) {
        if (this.grid[i] > 2) this.grid[i] = 2;
      }
    }
  }

  setEcologyProfile(profile: EcologyProfileName) {
    const resolved = ECOLOGY_PROFILES[profile]?.name ?? 'None';
    if (this.ecologyProfile === resolved) return;
    this.ecologyProfile = resolved;
    if (resolved === 'None') {
      this.ecologyBias = null;
      this.ecologyAffinity = null;
    } else {
      const tables = buildEcologyTables(this.latCells, this.lonCells, resolved);
      this.ecologyBias = tables.bias;
      this.ecologyAffinity = tables.affinity;
    }
  }

  getEcologyBiasView(): Int8Array | null {
    return this.ecologyBias;
  }

  setPolarWrap(polarWrap: boolean) {
    this.polarWrap = Boolean(polarWrap);
  }

  setColonyBiomeAffinity(enabled: boolean) {
    this.colonyBiomeAffinity = enabled;
  }

  setSolarCycleSpeed(speed: number) {
    this.solarCycleSpeed = Number.isFinite(speed) && speed > 0 ? speed : 0;
  }

  getSolarPhase(): number {
    return this.solarPhase;
  }

  setDynamicFertility(enabled: boolean) {
    const nextEnabled = Boolean(enabled);
    if (this.dynamicFertility && !nextEnabled) {
      this.soil.fill(SOIL_NEUTRAL);
      this.soilNext.fill(SOIL_NEUTRAL);
    }
    this.dynamicFertility = nextEnabled;
  }

  protected coordsToIdx(lat: number, lon: number): number {
    let la: number;
    let lo = lon;
    if (this.polarWrap) {
      const safeLat = Number.isFinite(lat) ? Math.trunc(lat) : 0;
      const period = this.latCells * 2;
      const wrapped = ((safeLat % period) + period) % period;
      if (wrapped >= this.latCells) {
        la = period - 1 - wrapped;
        lo += Math.floor(this.lonCells / 2);
      } else {
        la = wrapped;
      }
    } else {
      la = clampInt(lat, 0, this.latCells - 1);
    }
    lo = ((lo % this.lonCells) + this.lonCells) % this.lonCells;
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
    const idx = this.coordsToIdx(lat, lon);
    const wasAlive = this.grid[idx] > 0;
    const isAlive = value > 0;
    this.setCellState(idx, value);
    if (wasAlive !== isAlive) {
      this.rebuildAliveIndices();
    }
  }

  clear() {
    this.grid.fill(0);
    this.next.fill(0);
    this.age.fill(0);
    this.ageNext.fill(0);
    this.neighborHeat.fill(0);
    this.neighborHeatNext.fill(0);
    this.soil.fill(SOIL_NEUTRAL);
    this.soilNext.fill(SOIL_NEUTRAL);
    this.solarPhase = 0;
    this.aliveCount = 0;
    this.nextAliveCount = 0;
    this.population = 0;
    this.colonyAPopulation = 0;
    this.colonyBPopulation = 0;
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
    this.soil.fill(SOIL_NEUTRAL);
    this.soilNext.fill(SOIL_NEUTRAL);
    this.solarPhase = 0;
    this.rebuildAliveIndices();
    // Treat randomize the same as clear: a fresh population should not show
    // the previous generation count. Previously only clear() reset
    // generation, which made the HUD read e.g. \"Gen: 1000\" on a freshly
    // randomized grid.
    this.generation = 0;
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
    fertilityDelta?: number;
    debug?: boolean;
  }) {
    const rng = params.rng ?? Math.random;
    const scale = Math.max(1, Math.floor(params.scale));
    const jitter = Math.max(0, Math.floor(params.jitter));
    const p = Math.max(0, Math.min(1, params.probability));
    const fertilityDelta = params.fertilityDelta ?? 0;

    if (params.debug) {
      // eslint-disable-next-line no-console
      console.log(
        `[LifeGridSim] seedAtCell: mode=${params.mode} offsets=${params.offsets.length} scale=${scale} p=${p} jitter=${jitter}`,
      );
    }

    const transformed = transformOffsets(params.offsets, params.scale, params.jitter, rng);

    for (const [dLa, dLo] of transformed) {
      const idx = this.coordsToIdx(params.lat + dLa, params.lon + dLo);
      const currentVal = this.grid[idx];
      const nextVal = calculateNextCellState(currentVal, params.mode, this.gameMode, rng, p);
      this.setCellState(idx, nextVal);
      if (this.dynamicFertility && fertilityDelta !== 0) {
        const nextSoil = Math.round(this.soil[idx] + fertilityDelta);
        this.soil[idx] = nextSoil < SOIL_MIN ? SOIL_MIN : nextSoil > SOIL_MAX ? SOIL_MAX : nextSoil;
      }
    }

    this.rebuildAliveIndices();
  }

  protected rebuildAliveIndices() {
    let pop = 0;
    let colA = 0;
    let colB = 0;
    this.aliveCount = 0;
    for (let i = 0; i < this.cellCount; i++) {
      const v = this.grid[i];
      if (v > 0) {
        pop++;
        if (v === 1) colA++;
        else colB++;
        this.aliveIndices[this.aliveCount++] = i;
      }
    }
    this.population = pop;
    this.colonyAPopulation = colA;
    this.colonyBPopulation = colB;
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

  getSoilView(): Uint8Array {
    return this.soil;
  }

  getAliveIndicesView(): Int32Array {
    return this.aliveIndices;
  }

  getAliveCount(): number {
    return this.aliveCount;
  }

  protected runStep(stepFn: (ctx: LifeGridStepContext) => void): void {
    const ctx: LifeGridStepContext = {
      latCells: this.latCells,
      lonCells: this.lonCells,
      grid: this.grid,
      next: this.next,
      age: this.age,
      ageNext: this.ageNext,
      neighborHeatNext: this.neighborHeatNext,
      soil: this.soil,
      soilNext: this.soilNext,
      nextAliveIndices: this.nextAliveIndices,
      rules: this.rules,
      ecologyProfile: this.ecologyProfile,
      ecologyBias: this.ecologyBias,
      ecologyAffinity: this.ecologyAffinity,
      polarWrap: this.polarWrap,
      generation: this.generation,
      colonyBiomeAffinity: this.colonyBiomeAffinity,
      solarPhase: this.solarPhase,
      dynamicFertility: this.dynamicFertility,
      birthsLastTick: 0,
      deathsLastTick: 0,
      population: 0,
      colonyAPopulation: 0,
      colonyBPopulation: 0,
      nextAliveCount: 0,
    };

    stepFn(ctx);

    this.birthsLastTick = ctx.birthsLastTick;
    this.deathsLastTick = ctx.deathsLastTick;
    this.population = ctx.population;
    this.colonyAPopulation = ctx.colonyAPopulation;
    this.colonyBPopulation = ctx.colonyBPopulation;
    this.nextAliveCount = ctx.nextAliveCount;
    this.swapBuffers();
    this.solarPhase = advanceSolarPhase(this.solarPhase, this.solarCycleSpeed);
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

    if (this.dynamicFertility) {
      tmp = this.soil;
      this.soil = this.soilNext;
      this.soilNext = tmp;
    }

    const tmpIdx = this.aliveIndices;
    this.aliveIndices = this.nextAliveIndices;
    this.nextAliveIndices = tmpIdx;
    this.aliveCount = this.nextAliveCount;
  }
}
