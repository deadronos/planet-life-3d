import { useCallback, useMemo } from 'react';
import * as THREE from 'three';

import { getBuiltinPatternOffsets, parseAsciiPattern } from '../../sim/patterns';
import type { SeedAtPointParams } from '../../sim/types';
import { buildRandomDiskOffsets } from '../../sim/utils';
import type { SeedingSlice } from './controls';

type SimulationSeederParams = {
  seedAtPointImpl: (params: SeedAtPointParams) => void;
  updateInstances: () => void;
  seeding: SeedingSlice;
  debugLogs: boolean;
};

export function useSimulationSeeder({
  seedAtPointImpl,
  updateInstances,
  seeding,
  debugLogs,
}: SimulationSeederParams) {
  const { seedPattern, seedScale, seedMode, seedJitter, seedProbability, customPattern } = seeding;
  const currentPatternOffsets = useMemo(() => {
    if (seedPattern === 'Custom ASCII') return parseAsciiPattern(customPattern);
    if (seedPattern === 'Random Disk') return []; // generated at impact
    return getBuiltinPatternOffsets(seedPattern);
  }, [seedPattern, customPattern]);

  const randomDiskOffsets = useCallback(() => buildRandomDiskOffsets(seedScale), [seedScale]);

  const seedAtPoint = useCallback(
    (point: THREE.Vector3) => {
      const offsets = seedPattern === 'Random Disk' ? randomDiskOffsets() : currentPatternOffsets;

      if (debugLogs) {
        // eslint-disable-next-line no-console
        console.log(`[PlanetLife] seedAtPoint pattern=${seedPattern} offsets=${offsets.length}`);
      }

      seedAtPointImpl({
        point,
        offsets,
        mode: seedMode,
        // Disk offsets are already in final cell units (radius == seedScale);
        // scaling them again would make the disk radius quadratic in scale.
        scale: seedPattern === 'Random Disk' ? 1 : seedScale,
        jitter: seedJitter,
        probability: seedProbability,
        debug: debugLogs,
      });
      updateInstances();
    },
    [
      seedAtPointImpl,
      seedPattern,
      randomDiskOffsets,
      currentPatternOffsets,
      seedMode,
      seedScale,
      seedJitter,
      seedProbability,
      updateInstances,
      debugLogs,
    ],
  );

  return { seedAtPoint };
}
