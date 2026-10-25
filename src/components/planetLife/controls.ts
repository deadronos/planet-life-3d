import { useEffect, useMemo } from 'react';

import type { EcologyProfileName } from '../../sim/ecology';
import { type ControlValues, useControlsStore } from '../../store/useControlsStore';
import { useUIStore } from '../../store/useUIStore';

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
 * They are hidden with Leva `render` rather than removed; their values live in
 * the controls store either way (gpuSim in particular must stay on when hidden).
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

/** Flat view of the control values. Keys stay flat; slices are derived from this. */
type FlatControls = ControlValues;

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
  const flat = useControlsStore() as FlatControls;

  // Mirror running/tickMs into the UI store so the transport bar can show them.
  useEffect(() => {
    useUIStore.getState().setSimPlayback({ running: flat.running, tickMs: flat.tickMs });
  }, [flat.running, flat.tickMs]);

  // Transport speed slider and Space hotkey write into the controls store, which
  // the Leva panel (once loaded) mirrors. Subscribed (not effect-run) so a command
  // fires once per request, not on every re-render.
  useEffect(
    () =>
      useUIStore.subscribe((state, prev) => {
        const { setControls, running } = useControlsStore.getState();
        if (state.simSpeedRequest && state.simSpeedRequest !== prev.simSpeedRequest) {
          setControls({ tickMs: state.simSpeedRequest.tickMs });
        }
        if (
          state.simCommand &&
          state.simCommand !== prev.simCommand &&
          state.simCommand.command === 'togglePlay'
        ) {
          setControls({ running: !running });
        }
      }),
    [],
  );

  return useMemo(() => toSlices(flat), [flat]);
}
