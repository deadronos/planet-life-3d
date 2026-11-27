import * as THREE from 'three';

import type { MeteorTool } from '../store/useUIStore';

/**
 * `user` = fired by a planet click; `shower` = spawned by the ambient meteor shower;
 * `reseed` = triggered by auto-reseed on stagnation/extinction.
 */
export type MeteorSource = 'user' | 'shower' | 'reseed';

export type MeteorVisualStyle = {
  coreColor: string;
  emissiveColor: string;
  trailColor: string;
  impactRingColor: THREE.ColorRepresentation;
  flashMultiplier: number;
};

export const DEFAULT_METEOR_STYLE: MeteorVisualStyle = {
  coreColor: '#ffd68a',
  emissiveColor: '#ffcc66',
  trailColor: '#ffbb55',
  impactRingColor: '#ffeeaa',
  flashMultiplier: 1.8,
};

export const TOOL_METEOR_STYLES: Record<Exclude<MeteorTool, 'Probe'>, MeteorVisualStyle> = {
  Life: {
    coreColor: '#a7f3d0',
    emissiveColor: '#34d399',
    trailColor: '#10b981',
    impactRingColor: '#34d399',
    flashMultiplier: 1.8,
  },
  Sterilizer: {
    coreColor: '#fecdd3',
    emissiveColor: '#f43f5e',
    trailColor: '#e11d48',
    impactRingColor: '#f43f5e',
    flashMultiplier: 2.1,
  },
  Mutation: {
    coreColor: '#e9d5ff',
    emissiveColor: '#c084fc',
    trailColor: '#a855f7',
    impactRingColor: '#c084fc',
    flashMultiplier: 2.0,
  },
  Comet: {
    coreColor: '#cffafe',
    emissiveColor: '#38bdf8',
    trailColor: '#22d3ee',
    impactRingColor: '#22d3ee',
    flashMultiplier: 1.9,
  },
};

/**
 * Resolve meteor and impact visual styling.
 * Shower meteors (and fallback calls without an active tool) stay clean and honor
 * the configured theme/default impact ring color.
 */
export function getMeteorVisualStyle(
  source: MeteorSource,
  tool?: MeteorTool,
  defaultImpactRingColor?: THREE.ColorRepresentation,
): MeteorVisualStyle {
  if (source === 'user' && tool && tool !== 'Probe') {
    return TOOL_METEOR_STYLES[tool];
  }
  if (defaultImpactRingColor !== undefined) {
    return {
      ...DEFAULT_METEOR_STYLE,
      impactRingColor: defaultImpactRingColor,
    };
  }
  return DEFAULT_METEOR_STYLE;
}

export type MeteorSpec = {
  id: string;
  source: MeteorSource;
  tool?: MeteorTool;
  origin: THREE.Vector3;
  direction: THREE.Vector3; // normalized
  speed: number;
  radius: number;
  trailLength: number;
  trailWidth: number;
  emissiveIntensity: number;
};

export function computeMeteorState(origin: THREE.Vector3, direction: THREE.Vector3) {
  return {
    pos: origin.clone(),
    dir: direction.clone().normalize(),
  };
}
