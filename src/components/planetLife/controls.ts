import { folder, useControls } from 'leva';
import { useEffect, useMemo, useRef } from 'react';

import { SIM_CONSTRAINTS, SIM_DEFAULTS } from '../../sim/constants';
import { ECOLOGY_PROFILE_NAMES, type EcologyProfileName } from '../../sim/ecology';
import { isGpuSimulationSupported } from '../../sim/gpuSupport';
import { BUILTIN_PATTERN_NAMES } from '../../sim/patterns';
import {
  COLOR_THEME_NAMES,
  COLOR_THEMES,
  RULE_PRESET_NAMES,
  RULE_PRESETS,
  WORLD_PRESET_NAMES,
  WORLD_PRESETS,
} from '../../sim/presets';
import { useUIStore } from '../../store/useUIStore';
import { prefersReducedMotion } from '../../utils/reducedMotion';

/** Simulation folder: run state, grid size, rules, ecology and random fill. */
export type SimSlice = {
  running: boolean;
  tickMs: number;
  latCells: number;
  lonCells: number;
  worldPreset: string;
  birthDigits: string;
  surviveDigits: string;
  ecologyProfile: EcologyProfileName;
  randomDensity: number;
  gameMode: 'Classic' | 'Colony';
};

/** Rendering + Upgrades (look) controls for the planet body and its lighting. */
export type PlanetSlice = {
  planetRadius: number;
  planetWireframe: boolean;
  planetRoughness: number;
  ecologyIntensity: number;
  theme: string;
  rimIntensity: number;
  rimPower: number;
  terminatorSharpness: number;
  terminatorBoost: number;
};

export type AtmosphereSlice = {
  atmosphereColor: string;
  atmosphereIntensity: number;
  atmosphereHeight: number;
};

/** Cell overlay / dots rendering, cell colours and the pulse animation. */
export type CellsSlice = {
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
  colonyColorA: string;
  colonyColorB: string;
  pulseSpeed: number;
  pulseIntensity: number;
};

export type MeteorsSlice = {
  meteorSpeed: number;
  meteorRadius: number;
  meteorCooldownMs: number;
  showerEnabled: boolean;
  showerInterval: number;
  meteorTrailLength: number;
  meteorTrailWidth: number;
  meteorEmissive: number;
};

export type ImpactsSlice = {
  impactFlashIntensity: number;
  impactFlashRadius: number;
  impactRingColor: string;
  impactRingDuration: number;
  impactRingSize: number;
};

export type SeedingSlice = {
  seedMode: 'set' | 'toggle' | 'clear' | 'random';
  seedPattern: string;
  seedScale: number;
  seedJitter: number;
  seedProbability: number;
  customPattern: string;
};

/** Debug/experiments. debugLogs is a Leva Debug folder toggle. */
export type DebugSlice = {
  debugLogs: boolean;
  workerSim: boolean;
  gpuSim: boolean;
};

/**
 * Debug controls are only shown in dev builds or when the URL has `?debug`.
 * They are hidden with Leva `render` rather than removed, so their values keep
 * their defaults (gpuSim in particular must stay on when the panel is hidden).
 */
export function isDebugUiEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');
}

/** Every control, grouped by domain slice. Slice keys mirror the Leva folders. */
export type PlanetLifeControls = {
  sim: SimSlice;
  planet: PlanetSlice;
  atmosphere: AtmosphereSlice;
  cells: CellsSlice;
  meteors: MeteorsSlice;
  impacts: ImpactsSlice;
  seeding: SeedingSlice;
  debug: DebugSlice;
};

/** Flat view of the Leva values. Leva keys stay flat; slices are derived from this. */
type FlatControls = SimSlice & {
  /** Preset selector (Simulation folder); not a slice field, only written via setRef. */
  rulePreset: string;
} & PlanetSlice &
  AtmosphereSlice &
  CellsSlice &
  MeteorsSlice &
  ImpactsSlice &
  SeedingSlice &
  DebugSlice;

function toSlices(p: FlatControls): PlanetLifeControls {
  return {
    sim: {
      running: p.running,
      tickMs: p.tickMs,
      latCells: p.latCells,
      lonCells: p.lonCells,
      worldPreset: p.worldPreset,
      birthDigits: p.birthDigits,
      surviveDigits: p.surviveDigits,
      ecologyProfile: p.ecologyProfile,
      randomDensity: p.randomDensity,
      gameMode: p.gameMode,
    },
    planet: {
      planetRadius: p.planetRadius,
      planetWireframe: p.planetWireframe,
      planetRoughness: p.planetRoughness,
      ecologyIntensity: p.ecologyIntensity,
      theme: p.theme,
      rimIntensity: p.rimIntensity,
      rimPower: p.rimPower,
      terminatorSharpness: p.terminatorSharpness,
      terminatorBoost: p.terminatorBoost,
    },
    atmosphere: {
      atmosphereColor: p.atmosphereColor,
      atmosphereIntensity: p.atmosphereIntensity,
      atmosphereHeight: p.atmosphereHeight,
    },
    cells: {
      cellRenderMode: p.cellRenderMode,
      cellOverlayOpacity: p.cellOverlayOpacity,
      cellRadius: p.cellRadius,
      cellLift: p.cellLift,
      cellColor: p.cellColor,
      cellColorMode: p.cellColorMode,
      ageFadeHalfLife: p.ageFadeHalfLife,
      heatLowColor: p.heatLowColor,
      heatMidColor: p.heatMidColor,
      heatHighColor: p.heatHighColor,
      colonyColorA: p.colonyColorA,
      colonyColorB: p.colonyColorB,
      pulseSpeed: p.pulseSpeed,
      pulseIntensity: p.pulseIntensity,
    },
    meteors: {
      meteorSpeed: p.meteorSpeed,
      meteorRadius: p.meteorRadius,
      meteorCooldownMs: p.meteorCooldownMs,
      showerEnabled: p.showerEnabled,
      showerInterval: p.showerInterval,
      meteorTrailLength: p.meteorTrailLength,
      meteorTrailWidth: p.meteorTrailWidth,
      meteorEmissive: p.meteorEmissive,
    },
    impacts: {
      impactFlashIntensity: p.impactFlashIntensity,
      impactFlashRadius: p.impactFlashRadius,
      impactRingColor: p.impactRingColor,
      impactRingDuration: p.impactRingDuration,
      impactRingSize: p.impactRingSize,
    },
    seeding: {
      seedMode: p.seedMode,
      seedPattern: p.seedPattern,
      seedScale: p.seedScale,
      seedJitter: p.seedJitter,
      seedProbability: p.seedProbability,
      customPattern: p.customPattern,
    },
    debug: {
      debugLogs: p.debugLogs,
      workerSim: p.workerSim,
      gpuSim: p.gpuSim,
    },
  };
}

export function usePlanetLifeControls(): PlanetLifeControls {
  const patternOptions = useMemo(
    () => [...BUILTIN_PATTERN_NAMES, 'Custom ASCII', 'Random Disk'],
    [],
  );

  const setRef = useRef<((value: Partial<FlatControls>) => void) | null>(null);

  const debugUi = isDebugUiEnabled();

  const [params, set] = useControls(() => ({
    Basics: folder(
      {
        worldPreset: {
          label: 'World Preset',
          // onChange makes Leva inputs transient by default (value omitted from
          // the hook result); keep the value so the HUD can show it.
          transient: false,
          value: 'Custom',
          options: ['Custom', ...WORLD_PRESET_NAMES],
          onChange: (v: string) => {
            if (v === 'Custom' || !setRef.current) return;
            const p = WORLD_PRESETS[v];
            const theme = COLOR_THEMES[p.theme];
            setRef.current({
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
              ...(theme
                ? {
                    cellColor: theme.cellColor,
                    atmosphereColor: theme.atmosphereColor,
                    heatLowColor: theme.heatLowColor,
                    heatMidColor: theme.heatMidColor,
                    heatHighColor: theme.heatHighColor,
                    impactRingColor: theme.impactRingColor,
                  }
                : {}),
            });
          },
        },
        theme: {
          label: 'Theme',
          transient: false,
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
        cellRenderMode: {
          label: 'Cell Render Mode',
          value: 'Texture' as const,
          options: ['Texture', 'Dots', 'Both'] as const,
        },
      },
      { collapsed: false },
    ),

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
          transient: false,
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
        ecologyProfile: {
          label: 'Ecology',
          value: 'Garden World',
          options: ECOLOGY_PROFILE_NAMES,
        },
        randomDensity: { value: 0.14, min: 0, max: 1, step: 0.01 },
      },
      { collapsed: true },
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
        ecologyIntensity: { value: 0.65, min: 0, max: 1, step: 0.01 },
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
        rimIntensity: { value: 0.65, min: 0, max: 2, step: 0.01 },
        rimPower: { value: 2.6, min: 0.5, max: 6, step: 0.05 },
        terminatorSharpness: { value: 8, min: 1, max: 16, step: 0.5 },
        terminatorBoost: { value: 0, min: -0.4, max: 0.6, step: 0.01 },
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
        // Softer flash by default when the OS asks for reduced motion.
        impactFlashIntensity: {
          value: prefersReducedMotion() ? 0.25 : 0.75,
          min: 0,
          max: 4,
          step: 0.05,
        },
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
      { collapsed: true },
    ),

    Debug: folder(
      {
        debugLogs: { value: false, render: () => debugUi },

        // Experimental: offload simulation ticking to a Web Worker.
        // Rendering still happens on the main thread.
        workerSim: { value: false, render: () => debugUi },

        // Experimental: run simulation on GPU using shaders
        // This allows for much higher resolutions (512x1024+).
        // Default to ON when the browser supports WebGL2 + float-color-buffer
        // rendering; otherwise we silently fall back to the CPU/Worker sim
        // path (PlanetLife also tolerates a missing GPU texture by using
        // the CPU life texture, so a runtime init failure here won't blank
        // the planet).
        gpuSim: { value: isGpuSimulationSupported(), render: () => debugUi },
      },
      { collapsed: true },
    ),
  }));

  useEffect(() => {
    setRef.current = set;
  }, [set]);

  // Mirror running/tickMs into the UI store so the transport bar can show them.
  useEffect(() => {
    useUIStore.getState().setSimPlayback({ running: params.running, tickMs: params.tickMs });
  }, [params.running, params.tickMs]);

  // Transport speed slider: write the requested tick interval through Leva.
  useEffect(
    () =>
      useUIStore.subscribe((state, prev) => {
        const request = state.simSpeedRequest;
        if (!request || request === prev.simSpeedRequest) return;
        setRef.current?.({ tickMs: request.tickMs });
      }),
    [],
  );

  // Space hotkey: flip the Leva `running` control. Subscribed (not effect-run)
  // so a command fires once per request, not on every re-render.
  const runningRef = useRef(params.running);
  useEffect(() => {
    runningRef.current = params.running;
  }, [params.running]);
  useEffect(
    () =>
      useUIStore.subscribe((state, prev) => {
        const request = state.simCommand;
        if (!request || request === prev.simCommand) return;
        if (request.command === 'togglePlay') {
          setRef.current?.({ running: !runningRef.current });
        }
      }),
    [],
  );

  // Dots / Both cell render modes require a CPU/Worker sim (Dots uses an
  // instanced mesh driven from the sim state). When GPU sim is on there
  // is no CPU grid to read from, so silently disabling Dots would leave
  // the user with no visible cells. Force cellRenderMode back to Texture
  // the moment GPU sim is enabled so the dropdown visibly reflects the
  // limitation.
  useEffect(() => {
    if (params.gpuSim && (params.cellRenderMode === 'Dots' || params.cellRenderMode === 'Both')) {
      set({ cellRenderMode: 'Texture' });
    }
  }, [params.gpuSim, params.cellRenderMode, set]);

  const flat = params as unknown as FlatControls;
  return useMemo(() => toSlices(flat), [flat]);
}
