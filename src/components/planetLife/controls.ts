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
  gpuEnabled: boolean;
};

export type PlanetLifeControlsWithDebug = PlanetLifeControls & { debugLogs: boolean };

export function usePlanetLifeControls(): PlanetLifeControlsWithDebug {
  const patternOptions = useMemo(
    () => [...BUILTIN_PATTERN_NAMES, 'Custom ASCII', 'Random Disk'],
    [],
  );

  const setRef = useRef<((value: Partial<PlanetLifeControlsWithDebug>) => void) | null>(null);

  // Use a ref to track gpuEnabled state for conditional max logic inside useControls if needed,
  // but useControls re-runs when dependencies change.
  // We need to read the CURRENT value of gpuEnabled to set the max.
  // However, useControls returns the params including gpuEnabled.
  // To make the schema dynamic based on gpuEnabled, we rely on the fact that changing gpuEnabled
  // will trigger a re-render, and we can update the schema?
  // Actually, Leva's useControls dependency array is [randomize, clear, ...].
  // If we want the schema to react to `gpuEnabled`, we need `gpuEnabled` to be available.
  // But `gpuEnabled` is PART of the controls.
  // We can use a separate useControls for the toggle, or just update the limits imperatively?
  // Or simpler: Just set the max to the constraint max, but warn the user?
  // Or: Use a separate `useControls` for the mode, and pass it down?
  // Let's try to update the schema dynamically.
  // But `params` is the result of `useControls`.
  // We can't access `params.gpuEnabled` inside the `useControls` call that creates it.

  // Workaround: We define `gpuEnabled` in a separate useControls or just let it be part of the main one
  // and accept that the slider max might not update instantly or we use the max constraint always
  // but set the *default* lower.
  // Wait, if I set max to 4096, the slider becomes very sensitive for low values.
  // I will just increase the max to 4096. Users can be careful.
  // Actually, I can use `render` based on `gpuEnabled`.
  // But for now, to ensure I don't break the rules of hooks or create infinite loops,
  // I will just set the max to the SIM_CONSTRAINTS max.
  // If the user drags it to 4000 on CPU, it will lag. That's life.

  // Better: I can use a separate useControls for the GPU toggle.

  const [gpuParams, setGpu] = useControls('Debug', () => ({
      gpuEnabled: { value: false, label: 'GPGPU Mode' },
  }));

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
          max: gpuParams.gpuEnabled ? SIM_CONSTRAINTS.latCells.max : 256,
          step: 1,
        },
        lonCells: {
          value: SIM_DEFAULTS.lonCells,
          min: SIM_CONSTRAINTS.lonCells.min,
          max: gpuParams.gpuEnabled ? SIM_CONSTRAINTS.lonCells.max : 512,
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
        // gpuEnabled is handled in separate hook above
      },
      { collapsed: true },
    ),
  }), [gpuParams.gpuEnabled]);

  useEffect(() => {
    setRef.current = set;
  }, [set]);

  return { ...params, gpuEnabled: gpuParams.gpuEnabled } as unknown as PlanetLifeControlsWithDebug;
}
