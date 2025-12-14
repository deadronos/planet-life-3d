import { folder, useControls } from 'leva';
import { useMemo } from 'react';
import { BUILTIN_PATTERN_NAMES } from '../../sim/patterns';

export type PlanetLifeControls = {
  running: boolean;
  tickMs: number;
  latCells: number;
  lonCells: number;
  birthDigits: string;
  surviveDigits: string;
  randomDensity: number;
  planetRadius: number;
  planetWireframe: boolean;
  planetRoughness: number;
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
  meteorCooldownMs: number;
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
};

export type PlanetLifeControlsWithDebug = PlanetLifeControls & { debugLogs: boolean };

export function usePlanetLifeControls(): PlanetLifeControlsWithDebug {
  const patternOptions = useMemo(
    () => [...BUILTIN_PATTERN_NAMES, 'Custom ASCII', 'Random Disk'],
    [],
  );

  const params = useControls({
    Simulation: folder(
      {
        running: true,
        tickMs: { value: 120, min: 10, max: 1500, step: 1 },
        latCells: { value: 48, min: 8, max: 140, step: 1 },
        lonCells: { value: 96, min: 8, max: 240, step: 1 },
        birthDigits: { value: '3' },
        surviveDigits: { value: '23' },
        randomDensity: { value: 0.14, min: 0, max: 1, step: 0.01 },
      },
      { collapsed: false },
    ),

    Rendering: folder(
      {
        planetRadius: { value: 2.6, min: 1.2, max: 6, step: 0.05 },
        planetWireframe: false,
        planetRoughness: { value: 0.9, min: 0.05, max: 1, step: 0.01 },
        cellRenderMode: {
          value: 'Texture' as const,
          options: ['Texture', 'Dots', 'Both'] as const,
        },
        cellOverlayOpacity: { value: 1, min: 0, max: 2, step: 0.01 },
        cellRadius: { value: 0.05, min: 0.01, max: 0.15, step: 0.005 },
        cellLift: { value: 0.04, min: 0, max: 0.25, step: 0.005 },
        cellColor: '#3dd54c',
      },
      { collapsed: true },
    ),

    Upgrades: folder(
      {
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
        impactFlashIntensity: { value: 1.5, min: 0, max: 4, step: 0.05 },
        impactFlashRadius: { value: 0.45, min: 0.05, max: 2, step: 0.05 },
        impactRingColor: '#ffeeaa',
        impactRingDuration: { value: 0.9, min: 0.2, max: 2, step: 0.05 },
        impactRingSize: { value: 1, min: 0.4, max: 2.5, step: 0.05 },
      },
      { collapsed: true },
    ),

    Meteors: folder(
      {
        meteorSpeed: { value: 10, min: 1, max: 40, step: 0.5 },
        meteorRadius: { value: 0.08, min: 0.02, max: 0.3, step: 0.01 },
        meteorCooldownMs: { value: 120, min: 0, max: 1000, step: 10 },
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
      },
      { collapsed: true },
    ),
  });

  return params as unknown as PlanetLifeControlsWithDebug;
}
