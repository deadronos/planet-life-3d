import { create } from 'zustand';

import type { EcologyProfileName, EcologySample } from '../sim/ecology';

export interface GameStats {
  generation: number;
  population: number;
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

export interface PlanetStatus {
  preset: string;
  ecologyProfile: EcologyProfileName;
  gameMode: 'Classic' | 'Colony';
  seedPattern: string;
  gpuSim: boolean;
}

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
  planetStatus: PlanetStatus;
  activeTool: MeteorTool;
  probe: ProbeStatus | undefined;
  /** Wrapped in an object so repeated requests for the same command still notify. */
  simCommand: { command: SimCommand } | undefined;
  requestSimCommand: (command: SimCommand) => void;
  /** Mirror of the Leva `running` / `tickMs` controls, written by controls.ts. */
  simRunning: boolean;
  simTickMs: number;
  /** Wrapped like simCommand so repeated requests for the same speed still notify. */
  simSpeedRequest: { tickMs: number } | undefined;
  requestSimTickMs: (tickMs: number) => void;
  setSimPlayback: (playback: { running: boolean; tickMs: number }) => void;
  /** Meteors + impacts currently animating; any non-zero value needs continuous rendering. */
  activeEffectCount: number;
  setActiveEffectCount: (count: number) => void;
  setStats: (stats: GameStats) => void;
  setPlanetStatus: (status: PlanetStatus) => void;
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
  planetStatus: {
    preset: 'Custom',
    ecologyProfile: 'None',
    gameMode: 'Classic',
    seedPattern: 'Glider',
    gpuSim: false,
  },
  graphicsStatus: 'ok',
  graphicsEpoch: 0,
  setGraphicsStatus: (graphicsStatus) => set({ graphicsStatus }),
  bumpGraphicsEpoch: () => set((state) => ({ graphicsEpoch: state.graphicsEpoch + 1 })),
  activeTool: 'Life',
  probe: undefined,
  simCommand: undefined,
  requestSimCommand: (command) => set({ simCommand: { command } }),
  simRunning: true,
  simTickMs: 120,
  simSpeedRequest: undefined,
  // Optimistic mirror so a dragged slider does not snap back while Leva catches up.
  requestSimTickMs: (tickMs) => set({ simTickMs: tickMs, simSpeedRequest: { tickMs } }),
  setSimPlayback: ({ running, tickMs }) => set({ simRunning: running, simTickMs: tickMs }),
  activeEffectCount: 0,
  setActiveEffectCount: (activeEffectCount) => set({ activeEffectCount }),
  setStats: (stats) => set({ stats }),
  setPlanetStatus: (planetStatus) => set({ planetStatus }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setProbe: (probe) => set({ probe }),
}));
