import { SIM_CONSTRAINTS } from '../sim/constants';
import { ECOLOGY_PROFILE_NAMES, type EcologyProfileName } from '../sim/ecology';
import { BUILTIN_PATTERN_NAMES } from '../sim/patterns';
import { COLOR_THEME_NAMES, WORLD_PRESET_NAMES } from '../sim/presets';
import { parseWorldSeed } from '../sim/seededRng';
import type { ControlValues } from '../store/useControlsStore';

/**
 * Shareable world state in `location.hash`, e.g.
 * `#w=Garden+World&m=Classic&b=3&s=23&t=Default&e=Garden+World&sp=Glider&g=96x160&d=0.14&seed=12345`
 */
export type SharedWorld = {
  /** Preset applied first; every other field overrides its defaults. */
  preset?: Partial<Pick<ControlValues, 'worldPreset'>>;
  controls: Partial<ControlValues>;
  seed?: number;
};

const clampInt = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function digits(value: string | null): string | undefined {
  if (value === null || !/^[0-8]{0,9}$/.test(value)) return undefined;
  return [...new Set(value)].sort().join('');
}

/** Parse and validate a hash string. Unknown or invalid params are dropped. */
export function decodeWorld(hash: string): SharedWorld {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const controls: Partial<ControlValues> = {};
  const out: SharedWorld = { controls };

  const w = params.get('w');
  if (w && WORLD_PRESET_NAMES.includes(w)) out.preset = { worldPreset: w };

  const m = params.get('m');
  if (m === 'Classic' || m === 'Colony') controls.gameMode = m;

  const b = digits(params.get('b'));
  const s = digits(params.get('s'));
  if (b !== undefined) controls.birthDigits = b;
  if (s !== undefined) controls.surviveDigits = s;
  if (b !== undefined || s !== undefined) controls.rulePreset = 'Custom';

  const t = params.get('t');
  if (t && COLOR_THEME_NAMES.includes(t)) controls.theme = t;

  const e = params.get('e');
  if (e && (ECOLOGY_PROFILE_NAMES as string[]).includes(e)) {
    controls.ecologyProfile = e as EcologyProfileName;
  }

  const sp = params.get('sp');
  if (sp && BUILTIN_PATTERN_NAMES.includes(sp)) controls.seedPattern = sp;

  const g = /^(\d{1,4})x(\d{1,4})$/.exec(params.get('g') ?? '');
  if (g) {
    const { latCells, lonCells } = SIM_CONSTRAINTS;
    controls.latCells = clampInt(Number(g[1]), latCells.min, latCells.max);
    controls.lonCells = clampInt(Number(g[2]), lonCells.min, lonCells.max);
  }

  const d = params.get('d');
  if (d !== null && /^\d*\.?\d+$/.test(d)) {
    controls.randomDensity = Math.round(clampInt(Number(d), 0, 1) * 1000) / 1000;
  }

  out.seed = parseWorldSeed(params.get('seed'));
  return out;
}

/** Serialize the shareable subset of the current state to a hash (no leading `#`). */
export function encodeWorld(state: ControlValues, seed: number): string {
  const p = new URLSearchParams();
  if (state.worldPreset !== 'Custom') p.set('w', state.worldPreset);
  p.set('m', state.gameMode);
  p.set('b', state.birthDigits);
  p.set('s', state.surviveDigits);
  p.set('t', state.theme);
  p.set('e', state.ecologyProfile);
  p.set('sp', state.seedPattern);
  p.set('g', `${state.latCells}x${state.lonCells}`);
  p.set('d', String(Math.round(state.randomDensity * 1000) / 1000));
  p.set('seed', String(seed >>> 0));
  return p.toString();
}

/**
 * Apply a decoded world. The preset goes in first because `setControls` expands
 * preset side effects over the patch it receives; the explicit params follow so they win.
 */
export function applyWorld(
  world: SharedWorld,
  setControls: (patch: Partial<ControlValues>) => void,
): void {
  if (world.preset) setControls(world.preset);
  if (Object.keys(world.controls).length > 0) setControls(world.controls);
}

/** Read the hash on load; returns the seed to randomize with, if any. */
export function applyWorldFromLocation(
  setControls: (patch: Partial<ControlValues>) => void,
): number | undefined {
  if (typeof window === 'undefined' || !window.location.hash) return undefined;
  const world = decodeWorld(window.location.hash);
  applyWorld(world, setControls);
  return world.seed;
}
