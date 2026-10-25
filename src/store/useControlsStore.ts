import { create } from 'zustand';

import {
  DEFAULT_BLOOM_SETTINGS,
  defaultBloomEnabled,
} from '../components/postprocessing/bloomSettings';
import { SIM_DEFAULTS } from '../sim/constants';
import type { EcologyProfileName } from '../sim/ecology';
import { isGpuSimulationSupported } from '../sim/gpuSupport';
import { COLOR_THEMES, RULE_PRESETS, WORLD_PRESETS } from '../sim/presets';
import { prefersReducedMotion } from '../utils/reducedMotion';

/**
 * Every control value, flat and keyed exactly like its Leva input. The store
 * is the source of truth: the app reads it from first paint, and the lazily
 * loaded Leva panel (components/LevaPanel) mirrors it both ways.
 */
export type ControlValues = {
  // Camera / Performance / bloom (App)
  autoRotate: boolean;
  autoRotateSpeed: number;
  adaptiveResolution: boolean;
  bloomEnabled: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  bloomRadius: number;

  // Basics
  worldPreset: string;
  theme: string;
  cellRenderMode: 'Texture' | 'Dots' | 'Both';

  // Simulation
  gameMode: 'Classic' | 'Colony';
  running: boolean;
  tickMs: number;
  latCells: number;
  lonCells: number;
  rulePreset: string;
  birthDigits: string;
  surviveDigits: string;
  ecologyProfile: EcologyProfileName;
  randomDensity: number;

  // Rendering
  planetRadius: number;
  planetWireframe: boolean;
  planetRoughness: number;
  ecologyIntensity: number;
  cellOverlayOpacity: number;
  cellRadius: number;
  cellLift: number;
  pulseSpeed: number;
  pulseIntensity: number;
  cellColor: string;

  // Upgrades
  colonyColorA: string;
  colonyColorB: string;
  rimIntensity: number;
  rimPower: number;
  terminatorSharpness: number;
  terminatorBoost: number;
  nightGlowIntensity: number;
  nightGlowColor: string;
  atmosphereColor: string;
  atmosphereIntensity: number;
  atmosphereHeight: number;
  cellColorMode: 'Solid' | 'Age Fade' | 'Neighbor Heat';
  ageFadeHalfLife: number;
  heatLowColor: string;
  heatMidColor: string;
  heatHighColor: string;
  meteorTrailLength: number;
  meteorTrailWidth: number;
  meteorEmissive: number;
  impactFlashIntensity: number;
  impactFlashRadius: number;
  impactRingColor: string;
  impactRingDuration: number;
  impactRingSize: number;

  // Meteors
  meteorSpeed: number;
  meteorRadius: number;
  meteorCooldownMs: number;
  showerEnabled: boolean;
  showerInterval: number;

  // Seeding
  seedMode: 'set' | 'toggle' | 'clear' | 'random';
  seedPattern: string;
  seedScale: number;
  seedJitter: number;
  seedProbability: number;
  customPattern: string;

  // Debug
  debugLogs: boolean;
  workerSim: boolean;
  gpuSim: boolean;
};

export type ControlKey = keyof ControlValues;

/** Today's defaults, evaluated at call time (reduced motion, touch, GPU support). */
export function createControlDefaults(): ControlValues {
  return {
    autoRotate: !prefersReducedMotion(),
    autoRotateSpeed: 0.5,
    adaptiveResolution: true,
    bloomEnabled: defaultBloomEnabled(),
    bloomIntensity: DEFAULT_BLOOM_SETTINGS.intensity,
    bloomThreshold: DEFAULT_BLOOM_SETTINGS.threshold,
    bloomRadius: DEFAULT_BLOOM_SETTINGS.radius,

    worldPreset: 'Custom',
    theme: 'Default',
    cellRenderMode: 'Texture',

    gameMode: 'Classic',
    running: true,
    tickMs: 120,
    latCells: SIM_DEFAULTS.latCells,
    lonCells: SIM_DEFAULTS.lonCells,
    rulePreset: 'Conway',
    birthDigits: '3',
    surviveDigits: '23',
    ecologyProfile: 'Garden World',
    randomDensity: 0.14,

    planetRadius: SIM_DEFAULTS.planetRadius,
    planetWireframe: false,
    planetRoughness: 0.9,
    ecologyIntensity: 0.65,
    cellOverlayOpacity: 1,
    cellRadius: 0.05,
    cellLift: SIM_DEFAULTS.cellLift,
    pulseSpeed: 2.0,
    pulseIntensity: 0.2,
    cellColor: '#3dd54c',

    colonyColorA: '#ff3333',
    colonyColorB: '#3388ff',
    rimIntensity: 0.65,
    rimPower: 2.6,
    terminatorSharpness: 8,
    terminatorBoost: 0,
    // Night-side "city lights": dims unlit cells and adds a warm glow (0 = unlit look).
    nightGlowIntensity: 0.6,
    nightGlowColor: '#ffc46b',
    atmosphereColor: '#64d4ff',
    atmosphereIntensity: 0.55,
    atmosphereHeight: 0.06,
    cellColorMode: 'Neighbor Heat',
    ageFadeHalfLife: 24,
    heatLowColor: '#2ee488',
    heatMidColor: '#f0d96a',
    heatHighColor: '#ff6b55',
    meteorTrailLength: 0.9,
    meteorTrailWidth: 0.12,
    meteorEmissive: 2.6,
    // Softer flash by default when the OS asks for reduced motion.
    impactFlashIntensity: prefersReducedMotion() ? 0.25 : 0.75,
    impactFlashRadius: 0.4,
    impactRingColor: '#ffeeaa',
    impactRingDuration: 0.7,
    impactRingSize: 1,

    meteorSpeed: 10,
    meteorRadius: 0.08,
    meteorCooldownMs: 120,
    showerEnabled: true,
    showerInterval: 250,

    seedMode: 'set',
    seedPattern: 'Glider',
    seedScale: 1,
    seedJitter: 0,
    seedProbability: 0.7,
    customPattern: `\n..O..\n...O.\n.OOO.\n`.trim(),

    debugLogs: false,
    // Experimental: offload simulation ticking to a Web Worker.
    workerSim: false,
    // GPU sim defaults to ON when the browser supports WebGL2 + float-color-buffer
    // rendering; otherwise we fall back to the CPU/Worker sim path.
    gpuSim: isGpuSimulationSupported(),
  };
}

function themeColors(name: string): Partial<ControlValues> {
  const t = COLOR_THEMES[name];
  if (!t) return {};
  return {
    cellColor: t.cellColor,
    atmosphereColor: t.atmosphereColor,
    heatLowColor: t.heatLowColor,
    heatMidColor: t.heatMidColor,
    heatHighColor: t.heatHighColor,
    impactRingColor: t.impactRingColor,
  };
}

/** Side effects of picking a preset (formerly the Leva onChange handlers). */
function presetSideEffects(patch: Partial<ControlValues>): Partial<ControlValues> {
  const extra: Partial<ControlValues> = {};
  if (patch.worldPreset !== undefined && patch.worldPreset !== 'Custom') {
    const p = WORLD_PRESETS[patch.worldPreset];
    if (p) {
      Object.assign(extra, {
        rulePreset: 'Custom',
        birthDigits: p.birth,
        surviveDigits: p.survive,
        randomDensity: p.randomDensity,
        gameMode: p.gameMode,
        ecologyProfile: p.ecologyProfile,
        theme: p.theme,
        cellColorMode: p.cellColorMode,
        seedPattern: p.seedPattern,
        seedScale: p.seedScale,
        showerEnabled: p.showerEnabled,
        showerInterval: p.showerInterval,
        ...themeColors(p.theme),
      });
    }
  }
  if (patch.theme !== undefined && patch.theme !== 'Custom') {
    Object.assign(extra, themeColors(patch.theme));
  }
  if (patch.rulePreset !== undefined && patch.rulePreset !== 'Custom') {
    const p = RULE_PRESETS[patch.rulePreset];
    if (p) Object.assign(extra, { birthDigits: p.birth, surviveDigits: p.survive });
  }
  return extra;
}

interface ControlsState extends ControlValues {
  /**
   * Merge values. Picking a preset applies its side effects; enabling GPU sim
   * forces Dots/Both back to Texture (Dots needs a CPU grid to read from).
   */
  setControls: (patch: Partial<ControlValues>) => void;
  /** Restore defaults (tests). */
  resetControls: () => void;
}

export const useControlsStore = create<ControlsState>((set, get) => ({
  ...createControlDefaults(),
  setControls: (patch) => {
    const state = get();
    const next: Partial<ControlValues> = { ...patch, ...presetSideEffects(patch) };
    const gpuSim = next.gpuSim ?? state.gpuSim;
    const mode = next.cellRenderMode ?? state.cellRenderMode;
    if (gpuSim && mode !== 'Texture') next.cellRenderMode = 'Texture';

    const changed = (Object.keys(next) as ControlKey[]).some((k) => next[k] !== state[k]);
    if (changed) set(next);
  },
  resetControls: () => set(createControlDefaults()),
}));

export function getControlValues(): ControlValues {
  return useControlsStore.getState();
}
