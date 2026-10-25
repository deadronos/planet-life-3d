// Test helper: the consumer hooks take Leva control slices, but many tests
// describe their inputs as flat fields. `sliced` regroups flat fixture fields
// into the slice keys so the hooks receive the production shape.
const SLICE_FIELDS: Record<string, readonly string[]> = {
  sim: [
    'running',
    'tickMs',
    'latCells',
    'lonCells',
    'worldPreset',
    'birthDigits',
    'surviveDigits',
    'ecologyProfile',
    'randomDensity',
    'gameMode',
  ],
  planet: [
    'planetRadius',
    'planetWireframe',
    'planetRoughness',
    'ecologyIntensity',
    'theme',
    'rimIntensity',
    'rimPower',
    'terminatorSharpness',
    'terminatorBoost',
  ],
  atmosphere: ['atmosphereColor', 'atmosphereIntensity', 'atmosphereHeight'],
  cells: [
    'cellRenderMode',
    'cellOverlayOpacity',
    'cellRadius',
    'cellLift',
    'cellColor',
    'cellColorMode',
    'ageFadeHalfLife',
    'heatLowColor',
    'heatMidColor',
    'heatHighColor',
    'colonyColorA',
    'colonyColorB',
    'pulseSpeed',
    'pulseIntensity',
    'nightGlowIntensity',
    'nightGlowColor',
  ],
  meteors: [
    'meteorSpeed',
    'meteorRadius',
    'meteorCooldownMs',
    'showerEnabled',
    'showerInterval',
    'meteorTrailLength',
    'meteorTrailWidth',
    'meteorEmissive',
  ],
  impacts: [
    'impactFlashIntensity',
    'impactFlashRadius',
    'impactRingColor',
    'impactRingDuration',
    'impactRingSize',
  ],
  seeding: [
    'seedMode',
    'seedPattern',
    'seedScale',
    'seedJitter',
    'seedProbability',
    'customPattern',
  ],
  debug: ['debugLogs', 'workerSim', 'gpuSim'],
};

/**
 * Returns the flat fixture with slice keys added. Flat keys are kept, so
 * hooks that still read top-level fields (e.g. `debugLogs`) keep working.
 * Typed as `never` because test fixtures are partial and loosely typed.
 */
export function sliced(flat: object): never {
  const record = flat as Record<string, unknown>;
  const out: Record<string, unknown> = { ...record };
  for (const [slice, keys] of Object.entries(SLICE_FIELDS)) {
    const group: Record<string, unknown> = {};
    for (const key of keys) {
      if (key in record) group[key] = record[key];
    }
    out[slice] = group;
  }
  return out as never;
}
