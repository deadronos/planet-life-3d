import { create } from 'zustand';

import type { EcologySample } from '../sim/ecology';
import { newWorldSeed } from '../sim/seededRng';
import { appendSample, replaceLastSample } from '../utils/populationHistory';
import { appendStatsSample, replaceLastStatsSample, type SimStatsSample } from '../utils/simStatus';

export interface GameStats {
  generation: number;
  population: number;
  colonyAPopulation?: number;
  colonyBPopulation?: number;
  birthsLastTick: number;
  deathsLastTick: number;
}

export type MeteorTool = 'Life' | 'Sterilizer' | 'Mutation' | 'Comet' | 'Probe';

export const METEOR_TOOLS: MeteorTool[] = ['Life', 'Sterilizer', 'Mutation', 'Comet', 'Probe'];

/**
 * Sim actions requested from outside the sim (e.g. keyboard hotkeys). The
 * sim components execute them with the same code paths as their Leva buttons.
 */
export type SimCommand = 'togglePlay' | 'step' | 'randomize' | 'clear';

export interface ProbeStatus {
  lat: number;
  lon: number;
  sample: EcologySample;
}

/** 'lost' = context lost, waiting for restore; 'stalled' = lost and not restored in time. */
export type GraphicsStatus = 'ok' | 'lost' | 'stalled';

interface UIState {
  graphicsStatus: GraphicsStatus;
  /** Bumped on every context restore so GL-owned resources are rebuilt. */
  graphicsEpoch: number;
  setGraphicsStatus: (status: GraphicsStatus) => void;
  bumpGraphicsEpoch: () => void;
  stats: GameStats;
  /** Last ~200 population samples; reset when the generation counter goes backwards. */
  populationHistory: number[];
  /** Recent stats samples for equilibrium/extinction detection; reset when generation goes backwards. */
  statsHistory: SimStatsSample[];
  activeTool: MeteorTool;
  probe: ProbeStatus | undefined;
  /** Wrapped in an object so repeated requests for the same command still notify. */
  simCommand: { command: SimCommand } | undefined;
  requestSimCommand: (command: SimCommand) => void;
  /** uint32 seed of the current world; every initial randomization draws from it. */
  worldSeed: number;
  setWorldSeed: (seed: number) => void;
  /** Meteors + impacts currently animating; any non-zero value needs continuous rendering. */
  activeEffectCount: number;
  setActiveEffectCount: (count: number) => void;
  setStats: (stats: GameStats) => void;
  setActiveTool: (tool: MeteorTool) => void;
  setProbe: (probe: ProbeStatus | undefined) => void;
}

export const useUIStore = create<UIState>((set) => ({
  stats: {
    generation: 0,
    population: 0,
    birthsLastTick: 0,
    deathsLastTick: 0,
  },
  populationHistory: [],
  statsHistory: [],
  graphicsStatus: 'ok',
  graphicsEpoch: 0,
  setGraphicsStatus: (graphicsStatus) => set({ graphicsStatus }),
  bumpGraphicsEpoch: () => set((state) => ({ graphicsEpoch: state.graphicsEpoch + 1 })),
  activeTool: 'Life',
  probe: undefined,
  simCommand: undefined,
  // A new Randomize picks a fresh seed before the sim reads it.
  requestSimCommand: (command) =>
    set(
      command === 'randomize'
        ? { simCommand: { command }, worldSeed: newWorldSeed() }
        : { simCommand: { command } },
    ),
  worldSeed: newWorldSeed(),
  setWorldSeed: (worldSeed) => set({ worldSeed }),
  activeEffectCount: 0,
  setActiveEffectCount: (activeEffectCount) => set({ activeEffectCount }),
  setStats: (stats) =>
    set((state) => {
      const prevGen = state.stats.generation;
      const history = state.populationHistory;
      let populationHistory: number[];
      if (history.length === 0 || stats.generation < prevGen) {
        populationHistory = [stats.population];
      } else if (stats.generation === prevGen) {
        populationHistory = replaceLastSample(history, stats.population);
      } else {
        populationHistory = appendSample(history, stats.population);
      }

      const prevStatsHistory = state.statsHistory;
      const sample: SimStatsSample = {
        generation: stats.generation,
        population: stats.population,
        birthsLastTick: stats.birthsLastTick,
        deathsLastTick: stats.deathsLastTick,
      };
      let statsHistory: SimStatsSample[];
      if (prevStatsHistory.length === 0 || stats.generation < prevGen) {
        statsHistory = [sample];
      } else if (stats.generation === prevGen) {
        statsHistory = replaceLastStatsSample(prevStatsHistory, sample);
      } else {
        statsHistory = appendStatsSample(prevStatsHistory, sample);
      }

      return { stats, populationHistory, statsHistory };
    }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setProbe: (probe) => set({ probe }),
}));
