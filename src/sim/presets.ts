import type { EcologyProfileName } from './ecology';
import type { GameMode } from './types';

export type RulePreset = {
  birth: string;
  survive: string;
};

export const RULE_PRESETS: Record<string, RulePreset> = {
  Conway: { birth: '3', survive: '23' },
  HighLife: { birth: '36', survive: '23' },
  'Day & Night': { birth: '3678', survive: '34678' },
  Seeds: { birth: '2', survive: '' },
  'Life without Death': { birth: '3', survive: '012345678' },
  Morley: { birth: '368', survive: '245' },
};

export type ColorTheme = {
  cellColor: string;
  atmosphereColor: string;
  heatLowColor: string;
  heatMidColor: string;
  heatHighColor: string;
  impactRingColor: string;
};

export const COLOR_THEMES: Record<string, ColorTheme> = {
  Default: {
    cellColor: '#3dd54c',
    atmosphereColor: '#64d4ff',
    heatLowColor: '#2ee488',
    heatMidColor: '#f0d96a',
    heatHighColor: '#ff6b55',
    impactRingColor: '#ffeeaa',
  },
  Mars: {
    cellColor: '#ff4500',
    atmosphereColor: '#ff8888',
    heatLowColor: '#800000',
    heatMidColor: '#cc4400',
    heatHighColor: '#ffff00',
    impactRingColor: '#ffccaa',
  },
  Matrix: {
    cellColor: '#00ff41',
    atmosphereColor: '#003b00',
    heatLowColor: '#003300',
    heatMidColor: '#008f11',
    heatHighColor: '#00ff41',
    impactRingColor: '#ccffcc',
  },
  Neon: {
    cellColor: '#ff00ff',
    atmosphereColor: '#00ffff',
    heatLowColor: '#5500aa',
    heatMidColor: '#aa00ff',
    heatHighColor: '#00ffff',
    impactRingColor: '#ffffff',
  },
  Ice: {
    cellColor: '#aaddff',
    atmosphereColor: '#ffffff',
    heatLowColor: '#004488',
    heatMidColor: '#4488cc',
    heatHighColor: '#ccffff',
    impactRingColor: '#e0ffff',
  },
};

export const RULE_PRESET_NAMES = Object.keys(RULE_PRESETS);
export const COLOR_THEME_NAMES = Object.keys(COLOR_THEMES);

export type WorldPreset = {
  description: string;
  birth: string;
  survive: string;
  randomDensity: number;
  gameMode: GameMode;
  ecologyProfile: EcologyProfileName;
  theme: keyof typeof COLOR_THEMES;
  cellColorMode: 'Solid' | 'Age Fade' | 'Neighbor Heat';
  seedPattern: string;
  seedScale: number;
  showerEnabled: boolean;
  showerInterval: number;
};

export const WORLD_PRESETS: Record<string, WorldPreset> = {
  'Garden World': {
    description: 'Forgiving rules, high fertility, visible bloom corridors.',
    birth: '3',
    survive: '23',
    randomDensity: 0.18,
    gameMode: 'Classic',
    ecologyProfile: 'Garden World',
    theme: 'Default',
    cellColorMode: 'Neighbor Heat',
    seedPattern: 'Glider',
    seedScale: 1,
    showerEnabled: true,
    showerInterval: 420,
  },
  'Harsh Mars': {
    description: 'Sparse life must find moisture and avoid dry highlands.',
    birth: '36',
    survive: '23',
    randomDensity: 0.06,
    gameMode: 'Classic',
    ecologyProfile: 'Harsh Mars',
    theme: 'Mars',
    cellColorMode: 'Age Fade',
    seedPattern: 'Random Disk',
    seedScale: 2,
    showerEnabled: false,
    showerInterval: 900,
  },
  'Crystal Plague': {
    description: 'Slow stable colonies spread through hostile ridges.',
    birth: '3',
    survive: '234',
    randomDensity: 0.09,
    gameMode: 'Colony',
    ecologyProfile: 'Crystal Plague',
    theme: 'Ice',
    cellColorMode: 'Age Fade',
    seedPattern: 'Ring',
    seedScale: 1,
    showerEnabled: true,
    showerInterval: 1200,
  },
  'Two Colonies': {
    description: 'Red and blue colonies compete under standard life pressure.',
    birth: '3',
    survive: '23',
    randomDensity: 0.16,
    gameMode: 'Colony',
    ecologyProfile: 'Garden World',
    theme: 'Neon',
    cellColorMode: 'Solid',
    seedPattern: 'Glider',
    seedScale: 1,
    showerEnabled: true,
    showerInterval: 650,
  },
  'Meteor Garden': {
    description: 'Frequent impacts keep reseeding a fertile but volatile world.',
    birth: '36',
    survive: '23',
    randomDensity: 0.12,
    gameMode: 'Classic',
    ecologyProfile: 'Meteor Garden',
    theme: 'Matrix',
    cellColorMode: 'Neighbor Heat',
    seedPattern: 'Random Disk',
    seedScale: 3,
    showerEnabled: true,
    showerInterval: 180,
  },
  'Extinction Event': {
    description: 'Low density and harsh terrain after a global reset.',
    birth: '3',
    survive: '23',
    randomDensity: 0.025,
    gameMode: 'Classic',
    ecologyProfile: 'Harsh Mars',
    theme: 'Mars',
    cellColorMode: 'Neighbor Heat',
    seedPattern: 'Acorn',
    seedScale: 1,
    showerEnabled: false,
    showerInterval: 1500,
  },
};

export const WORLD_PRESET_NAMES = Object.keys(WORLD_PRESETS);
