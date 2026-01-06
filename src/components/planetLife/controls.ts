import { folder, useControls } from 'leva';
import { useEffect, useMemo, useRef } from 'react';

import { SIM_CONSTRAINTS, SIM_DEFAULTS } from '../../sim/constants';
import { BUILTIN_PATTERN_NAMES } from '../../sim/patterns';
import {
  COLOR_THEME_NAMES,
  COLOR_THEMES,
  RULE_PRESET_NAMES,
  RULE_PRESETS,
} from '../../sim/presets';

export type PlanetLifeControls = {
  running: boolean;
  tickMs: number;
  latCells: number;
  lonCells: number;
  rulePreset: string;
  birthDigits: string;
  surviveDigits: string;
  randomDensity: number;
  planetRadius: number;
  planetWireframe: boolean;
  planetRoughness: number;
  theme: string;
  rimIntensity: number;
  rimPower: number;
  terminatorSharpness: number;
  terminatorBoost: number;
  atmosphereColor: string;
  atmosphereIntensity: number;
  atmosphereHeight: number;
  cellRenderMode: 'Texture' | 'Dots' | 'Both';
  cellOverlayOpacity: number;
  cellRadius: number;
  cellLift: number;
  cellColor: string;
  cellColorMode: 'Solid' | 'Age Fade' | 'Neighbor Heat';
  ageFadeHalfLife: number;
  heatLowColor: string;
  heatMidColor: string;
  heatHighColor: string;
  meteorSpeed: number;
  meteorRadius: number;
  colonyColorA: string;
  colonyColorB: string;
  gameMode: 'Classic' | 'Colony';
  meteorCooldownMs: number;
  showerEnabled: boolean;
  showerInterval: number;
  meteorTrailLength: number;
  meteorTrailWidth: number;
  meteorEmissive: number;
  impactFlashIntensity: number;
  impactFlashRadius: number;
  impactRingColor: string;
  impactRingDuration: number;
  impactRingSize: number;
  seedMode: 'set' | 'toggle' | 'clear' | 'random';
  seedPattern: string;
  seedScale: number;
  seedJitter: number;
  seedProbability: number;
  customPattern: string;

  // Debug/experiments
  workerSim: boolean;
  gpuSim: boolean;

  // Pulse
  pulseSpeed: number;
  pulseIntensity: number;
};

export type PlanetLifeControlsWithDebug = PlanetLifeControls & { debugLogs: boolean };

export function usePlanetLifeControls(): PlanetLifeControlsWithDebug {
  const patternOptions = useMemo(
    () => [...BUILTIN_PATTERN_NAMES, 'Custom ASCII', 'Random Disk'],
    [],
  );

  const setRef = useRef<((value: Partial<PlanetLifeControlsWithDebug>) => void) | null>(null);

  const [params, set] = useControls(() => ({
    Simulation: folder(
      {
        gameMode: {
          label: 'Game Mode',
          value: 'Classic' as const,
          options: ['Classic', 'Colony'] as const,
        },
        running: true,
        tickMs: { value: 120, min: 10, max: 1500, step: 1 },
        latCells: {
          value: SIM_DEFAULTS.latCells,
          min: SIM_CONSTRAINTS.latCells.min,
          max: 140,
          step: 1,
        },
        lonCells: {
          value: SIM_DEFAULTS.lonCells,
          min: SIM_CONSTRAINTS.lonCells.min,
          max: 240,
          step: 1,
        },
        rulePreset: {
          label: 'Rule Preset',
          value: 'Conway',
          options: ['Custom', ...RULE_PRESET_NAMES],
          onChange: (v: string) => {
            if (v === 'Custom' || !setRef.current) return;
            const p = RULE_PRESETS[v];
            if (p) {
              setRef.current({ birthDigits: p.birth, surviveDigits: p.survive });
            }
          },
        },
        birthDigits: { value: '3' },
        surviveDigits: { value: '23' },
        randomDensity: { value: 0.14, min: 0, max: 1, step: 0.01 },
      },
      { collapsed: false },
    ),

    Rendering: folder(
      {
        planetRadius: {
          value: SIM_DEFAULTS.planetRadius,
          min: 1.2,
          max: 6,
          step: 0.05,
        },
        planetWireframe: false,
        planetRoughness: { value: 0.9, min: 0.05, max: 1, step: 0.01 },
        cellRenderMode: {
          value: 'Texture' as const,
          options: ['Texture', 'Dots', 'Both'] as const,
        },
        cellOverlayOpacity: { value: 1, min: 0, max: 2, step: 0.01 },
        cellRadius: { value: 0.05, min: 0.01, max: 0.15, step: 0.005 },
        cellLift: {
          value: SIM_DEFAULTS.cellLift,
          min: SIM_CONSTRAINTS.cellLift.min,
          max: 0.25,
          step: 0.005,
        },
        pulseSpeed: { value: 2.0, min: 0, max: 10, step: 0.1 },
        pulseIntensity: { value: 0.2, min: 0, max: 1, step: 0.05 },
        cellColor: '#3dd54c',
      },
      { collapsed: true },
    ),

    Upgrades: folder(
      {
        colonyColorA: '#ff3333',
        colonyColorB: '#3388ff',
        theme: {
          label: 'Theme',
          value: 'Default',
          options: ['Custom', ...COLOR_THEME_NAMES],
          onChange: (v: string) => {
            if (v === 'Custom' || !setRef.current) return;
            const t = COLOR_THEMES[v];
            if (t) {
              setRef.current({
                cellColor: t.cellColor,
                atmosphereColor: t.atmosphereColor,
                heatLowColor: t.heatLowColor,
                heatMidColor: t.heatMidColor,
                heatHighColor: t.heatHighColor,
                impactRingColor: t.impactRingColor,
              });
            }
          },
        },
        rimIntensity: { value: 0.65, min: 0, max: 2, step: 0.01 },
        rimPower: { value: 2.6, min: 0.5, max: 6, step: 0.05 },
        terminatorSharpness: { value: 1.4, min: 0.2, max: 4, step: 0.05 },
        terminatorBoost: { value: 0.35, min: 0, max: 1, step: 0.01 },
        atmosphereColor: '#64d4ff',
        atmosphereIntensity: { value: 0.55, min: 0, max: 2, step: 0.01 },
        atmosphereHeight: { value: 0.06, min: 0, max: 0.35, step: 0.005 },
        cellColorMode: {
          value: 'Neighbor Heat' as const,
          options: ['Solid', 'Age Fade', 'Neighbor Heat'] as const,
        },
        ageFadeHalfLife: { value: 24, min: 2, max: 160, step: 1 },
        heatLowColor: '#2ee488',
        heatMidColor: '#f0d96a',
        heatHighColor: '#ff6b55',
        meteorTrailLength: { value: 0.9, min: 0.2, max: 3, step: 0.05 },
        meteorTrailWidth: { value: 0.12, min: 0.02, max: 0.4, step: 0.01 },
        meteorEmissive: { value: 2.6, min: 0.2, max: 5, step: 0.05 },
        impactFlashIntensity: { value: 0.75, min: 0, max: 4, step: 0.05 },
        impactFlashRadius: { value: 0.4, min: 0.05, max: 2, step: 0.05 },
        impactRingColor: '#ffeeaa',
        impactRingDuration: { value: 0.7, min: 0.2, max: 2, step: 0.05 },
        impactRingSize: { value: 1, min: 0.4, max: 2.5, step: 0.05 },
      },
      { collapsed: true },
    ),

    Meteors: folder(
      {
        meteorSpeed: { value: 10, min: 1, max: 40, step: 0.5 },
        meteorRadius: { value: 0.08, min: 0.02, max: 0.3, step: 0.01 },
        meteorCooldownMs: { value: 120, min: 0, max: 1000, step: 10 },
        showerEnabled: { value: true, label: 'Shower Enabled' },
        showerInterval: { value: 250, min: 50, max: 2000, step: 50, label: 'Shower Interval (ms)' },
      },
      { collapsed: true },
    ),

    Seeding: folder(
      {
        seedMode: {
          value: 'set' as const,
          options: ['set', 'toggle', 'clear', 'random'] as const,
        },
        seedPattern: { value: 'Glider', options: patternOptions },
        seedScale: { value: 1, min: 1, max: 8, step: 1 },
        seedJitter: { value: 0, min: 0, max: 6, step: 1 },
        seedProbability: { value: 0.7, min: 0, max: 1, step: 0.01 },
        customPattern: {
          value: `\n..O..\n...O.\n.OOO.\n`.trim(),
        },
      },
      { collapsed: false },
    ),

    Debug: folder(
      {
        debugLogs: false,

        // Experimental: offload simulation ticking to a Web Worker.
        // Rendering still happens on the main thread.
        workerSim: false,

        // Experimental: run simulation on GPU using shaders
        // This allows for much higher resolutions (512x1024+)
        gpuSim: false,
      },
      { collapsed: true },
    ),
  }));

  useEffect(() => {
    setRef.current = set;
  }, [set]);

  return params as unknown as PlanetLifeControlsWithDebug;
}
