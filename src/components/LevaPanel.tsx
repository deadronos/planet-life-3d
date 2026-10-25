import { button, folder, Leva, levaStore, useControls } from 'leva';
import { useEffect, useMemo } from 'react';

import { SIM_CONSTRAINTS } from '../sim/constants';
import { ECOLOGY_PROFILE_NAMES } from '../sim/ecology';
import { BUILTIN_PATTERN_NAMES } from '../sim/patterns';
import { COLOR_THEME_NAMES, RULE_PRESET_NAMES, WORLD_PRESET_NAMES } from '../sim/presets';
import { type ControlKey, type ControlValues, useControlsStore } from '../store/useControlsStore';
import { useUIStore } from '../store/useUIStore';
import { isDebugUiEnabled } from './planetLife/controls';

const levaTheme = {
  colors: {
    elevation1: 'rgba(13, 17, 28, 0.8)',
    elevation2: '#1a1f2e',
    elevation3: '#2d3345',
    accent1: '#6366f1',
    accent2: '#818cf8',
    accent3: '#a5b4fc',
    highlight1: '#94a3b8',
    highlight2: '#cbd5e1',
    highlight3: '#f8fafc',
  },
  fonts: {
    mono: "'Rajdhani', monospace",
    sans: "'Rajdhani', sans-serif",
  },
  sizes: {
    rootWidth: '340px',
  },
};

type InputOptions = Record<string, unknown>;
type FolderSchema = Parameters<typeof folder>[0];

/**
 * Build the whole Leva schema. Every input is seeded from the controls store
 * and writes back to it on change; `paths` collects each key's Leva path so
 * store changes can be pushed into the panel.
 */
function buildSchema(values: ControlValues, paths: Map<ControlKey, string>, debugUi: boolean) {
  const inFolder = (name: string, inputs: Partial<Record<ControlKey, InputOptions>>) => {
    const out: Record<string, InputOptions> = {};
    for (const key of Object.keys(inputs) as ControlKey[]) {
      paths.set(key, `${name}.${key}`);
      out[key] = {
        ...inputs[key],
        value: values[key],
        // Keep values in the hook result (an onChange makes inputs transient).
        transient: false,
        onChange: (v: unknown, _path: string, ctx: { initial: boolean }) => {
          if (ctx.initial) return;
          const store = useControlsStore.getState();
          // Leva shows numeric strings (birth/survive digits) as numbers; keep them strings.
          const value = typeof store[key] === 'string' && typeof v === 'number' ? String(v) : v;
          store.setControls({ [key]: value });
        },
      };
    }
    return out as unknown as FolderSchema;
  };
  const debugOnly = { render: () => debugUi };
  const patternOptions = [...BUILTIN_PATTERN_NAMES, 'Custom ASCII', 'Random Disk'];

  return {
    Camera: folder(
      inFolder('Camera', {
        autoRotate: { label: 'Auto Rotate' },
        autoRotateSpeed: { min: 0.1, max: 10, step: 0.1, label: 'Rotation Speed' },
      }),
      { collapsed: true },
    ),

    Performance: folder(
      inFolder('Performance', {
        adaptiveResolution: {
          label: 'Adaptive Resolution',
          // Disabling pins the renderer to the Canvas `dpr` range, which makes
          // it straightforward to A/B the two settings.
          hint: 'Drops pixel ratio when frame rate drops; restore when it recovers.',
        },
      }),
      { collapsed: true },
    ),

    Rendering: folder(
      inFolder('Rendering', {
        bloomEnabled: {
          label: 'Bloom',
          hint: 'Glow on the sun, meteors, impacts and atmosphere. Off by default on touch devices; pauses while adaptive resolution has lowered the pixel ratio.',
        },
        bloomIntensity: { min: 0, max: 3, step: 0.05, label: 'Bloom Intensity' },
        bloomThreshold: { min: 0.5, max: 3, step: 0.05, label: 'Bloom Threshold' },
        bloomRadius: { min: 0, max: 1, step: 0.05, label: 'Bloom Radius' },
        planetRadius: { min: 1.2, max: 6, step: 0.05 },
        planetWireframe: {},
        planetRoughness: { min: 0.05, max: 1, step: 0.01 },
        ecologyIntensity: { min: 0, max: 1, step: 0.01 },
        cellOverlayOpacity: { min: 0, max: 2, step: 0.01 },
        cellRadius: { min: 0.01, max: 0.15, step: 0.005 },
        cellLift: { min: SIM_CONSTRAINTS.cellLift.min, max: 0.25, step: 0.005 },
        pulseSpeed: { min: 0, max: 10, step: 0.1 },
        pulseIntensity: { min: 0, max: 1, step: 0.05 },
        cellColor: {},
      }),
      { collapsed: true },
    ),

    Basics: folder(
      inFolder('Basics', {
        worldPreset: { label: 'World Preset', options: ['Custom', ...WORLD_PRESET_NAMES] },
        theme: { label: 'Theme', options: ['Custom', ...COLOR_THEME_NAMES] },
        cellRenderMode: { label: 'Cell Render Mode', options: ['Texture', 'Dots', 'Both'] },
      }),
      { collapsed: false },
    ),

    Simulation: folder(
      inFolder('Simulation', {
        gameMode: { label: 'Game Mode', options: ['Classic', 'Colony'] },
        running: {},
        tickMs: { min: 10, max: 1500, step: 1 },
        latCells: { min: SIM_CONSTRAINTS.latCells.min, max: 140, step: 1 },
        lonCells: { min: SIM_CONSTRAINTS.lonCells.min, max: 240, step: 1 },
        rulePreset: { label: 'Rule Preset', options: ['Custom', ...RULE_PRESET_NAMES] },
        birthDigits: {},
        surviveDigits: {},
        ecologyProfile: { label: 'Ecology', options: ECOLOGY_PROFILE_NAMES },
        randomDensity: { min: 0, max: 1, step: 0.01 },
      }),
      { collapsed: true },
    ),

    Upgrades: folder(
      inFolder('Upgrades', {
        colonyColorA: {},
        colonyColorB: {},
        rimIntensity: { min: 0, max: 2, step: 0.01 },
        rimPower: { min: 0.5, max: 6, step: 0.05 },
        terminatorSharpness: { min: 1, max: 16, step: 0.5 },
        terminatorBoost: { min: -0.4, max: 0.6, step: 0.01 },
        atmosphereColor: {},
        atmosphereIntensity: { min: 0, max: 2, step: 0.01 },
        atmosphereHeight: { min: 0, max: 0.35, step: 0.005 },
        cellColorMode: { options: ['Solid', 'Age Fade', 'Neighbor Heat'] },
        ageFadeHalfLife: { min: 2, max: 160, step: 1 },
        heatLowColor: {},
        heatMidColor: {},
        heatHighColor: {},
        meteorTrailLength: { min: 0.2, max: 3, step: 0.05 },
        meteorTrailWidth: { min: 0.02, max: 0.4, step: 0.01 },
        meteorEmissive: { min: 0.2, max: 5, step: 0.05 },
        impactFlashIntensity: { min: 0, max: 4, step: 0.05 },
        impactFlashRadius: { min: 0.05, max: 2, step: 0.05 },
        impactRingColor: {},
        impactRingDuration: { min: 0.2, max: 2, step: 0.05 },
        impactRingSize: { min: 0.4, max: 2.5, step: 0.05 },
      }),
      { collapsed: true },
    ),

    Meteors: folder(
      inFolder('Meteors', {
        meteorSpeed: { min: 1, max: 40, step: 0.5 },
        meteorRadius: { min: 0.02, max: 0.3, step: 0.01 },
        meteorCooldownMs: { min: 0, max: 1000, step: 10 },
        showerEnabled: { label: 'Shower Enabled' },
        showerInterval: { min: 50, max: 2000, step: 50, label: 'Shower Interval (ms)' },
      }),
      { collapsed: true },
    ),

    Seeding: folder(
      inFolder('Seeding', {
        seedMode: { options: ['set', 'toggle', 'clear', 'random'] },
        seedPattern: { options: patternOptions },
        seedScale: { min: 1, max: 8, step: 1 },
        seedJitter: { min: 0, max: 6, step: 1 },
        seedProbability: { min: 0, max: 1, step: 0.01 },
        customPattern: {},
      }),
      { collapsed: true },
    ),

    // Debug controls are hidden with `render`, not removed (see isDebugUiEnabled).
    Debug: folder(
      inFolder('Debug', {
        debugLogs: debugOnly,
        workerSim: debugOnly,
        gpuSim: debugOnly,
      }),
      { collapsed: true },
    ),

    Actions: folder({
      Randomize: button(() => useUIStore.getState().requestSimCommand('randomize')),
      Clear: button(() => useUIStore.getState().requestSimCommand('clear')),
      StepOnce: button(() => useUIStore.getState().requestSimCommand('step')),
    }),
  };
}

/**
 * The Leva panel, loaded lazily after first paint (see App). It reflects the
 * controls store and writes edits back to it, so the app runs without it.
 */
export default function LevaPanel({ hidden }: { hidden: boolean }) {
  const paths = useMemo(() => new Map<ControlKey, string>(), []);
  const debugUi = isDebugUiEnabled();

  useControls(() => buildSchema(useControlsStore.getState(), paths, debugUi));

  // Store -> panel: push values changed elsewhere (presets, transport, hotkeys).
  useEffect(() => {
    const sync = (state: ControlValues) => {
      for (const [key, path] of paths) {
        const current: unknown = levaStore.get(path);
        // String() so a numeric-string value ('3') matches Leva's number (3).
        if (String(current) !== String(state[key])) {
          levaStore.setValueAtPath(path, state[key], false);
        }
      }
    };
    // Catch anything that changed between the schema read and this effect.
    sync(useControlsStore.getState());
    return useControlsStore.subscribe(sync);
  }, [paths]);

  return <Leva collapsed={true} theme={levaTheme} hidden={hidden} />;
}
