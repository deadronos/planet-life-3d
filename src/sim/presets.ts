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
