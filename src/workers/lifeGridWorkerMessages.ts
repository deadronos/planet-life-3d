import type { Offset } from '../sim/patterns';
import type { SeedMode, GameMode } from '../sim/LifeSimBase';
import type { Rules } from '../sim/rules';

export type LifeGridWorkerInit = {
  type: 'init';
  latCells: number;
  lonCells: number;
  rules: Rules;
  gameMode?: GameMode;
  randomDensity?: number;
};

export type LifeGridWorkerTick = {
  type: 'tick';
  steps?: number;
};

export type LifeGridWorkerSetRules = {
  type: 'setRules';
  rules: Rules;
};

export type LifeGridWorkerSetGameMode = {
  type: 'setGameMode';
  mode: GameMode;
};

export type LifeGridWorkerClear = { type: 'clear' };

export type LifeGridWorkerRandomize = {
  type: 'randomize';
  density: number;
};

export type LifeGridWorkerSeedAtCell = {
  type: 'seedAtCell';
  lat: number;
  lon: number;
  offsets: Offset[];
  mode: SeedMode;
  scale: number;
  jitter: number;
  probability: number;
  debug?: boolean;
};

export type LifeGridWorkerRecycle = {
  type: 'recycle';
  grid: ArrayBuffer;
  age: ArrayBuffer;
  heat: ArrayBuffer;
};

export type LifeGridWorkerInMessage =
  | LifeGridWorkerInit
  | LifeGridWorkerTick
  | LifeGridWorkerSetRules
  | LifeGridWorkerSetGameMode
  | LifeGridWorkerClear
  | LifeGridWorkerRandomize
  | LifeGridWorkerSeedAtCell
  | LifeGridWorkerRecycle;

export type LifeGridWorkerSnapshot = {
  type: 'snapshot';
  grid: ArrayBuffer;
  age: ArrayBuffer;
  heat: ArrayBuffer;
  generation: number;
  population: number;
  birthsLastTick: number;
  deathsLastTick: number;
};

export type LifeGridWorkerReady = { type: 'ready' };

export type LifeGridWorkerError = {
  type: 'error';
  message: string;
};

export type LifeGridWorkerOutMessage =
  | LifeGridWorkerSnapshot
  | LifeGridWorkerReady
  | LifeGridWorkerError;
