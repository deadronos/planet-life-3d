import { useCallback, useMemo } from 'react';
import * as THREE from 'three';

import type { SeedMode } from '../../sim/LifeSimBase';
import type { Offset } from '../../sim/patterns';
import { getBuiltinPatternOffsets, parseAsciiPattern } from '../../sim/patterns';
import { buildRandomDiskOffsets } from '../../sim/utils';

type SimulationSeederParams = {
  seedAtPointImpl: (params: {
    point: THREE.Vector3;
    offsets: Offset[];
    mode: SeedMode;
    scale: number;
    jitter: number;
    probability: number;
    debug?: boolean;
  }) => void;
  updateInstances: () => void;
  seedPattern: string;
  seedScale: number;
  seedMode: SeedMode;
  seedJitter: number;
  seedProbability: number;
  customPattern: string;
  debugLogs: boolean;
};

export function useSimulationSeeder({
  seedAtPointImpl,
  updateInstances,
  seedPattern,
  seedScale,
  seedMode,
  seedJitter,
  seedProbability,
  customPattern,
  debugLogs,
}: SimulationSeederParams) {
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
        scale: seedScale,
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
