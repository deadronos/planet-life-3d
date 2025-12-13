import { create } from 'zustand';

export interface GameStats {
  generation: number;
  population: number;
  birthsLastTick: number;
  deathsLastTick: number;
}

interface UIState {
  stats: GameStats;
  setStats: (stats: GameStats) => void;
}

export const useUIStore = create<UIState>((set) => ({
  stats: {
    generation: 0,
    population: 0,
    birthsLastTick: 0,
    deathsLastTick: 0,
  },
  setStats: (stats) => set({ stats }),
}));
