import { useCallback, useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';
import type { LifeSphereSim, SeedMode } from '../../sim/LifeSphereSim';
import { getBuiltinPatternOffsets, parseAsciiPattern } from '../../sim/patterns';

type SimulationSeederParams = {
  simRef: RefObject<LifeSphereSim | null>;
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
  simRef,
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

  const randomDiskOffsets = useCallback(() => {
    // Disk radius uses seedScale as size knob (handy and cheap)
    const r = Math.max(1, Math.floor(seedScale)) * 2;
    const offsets: Array<readonly [number, number]> = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) offsets.push([dy, dx]);
      }
    }
    return offsets;
  }, [seedScale]);

  const seedAtPoint = useCallback(
    (point: THREE.Vector3) => {
      const sim = simRef.current;
      if (!sim) return;

      const offsets = seedPattern === 'Random Disk' ? randomDiskOffsets() : currentPatternOffsets;

      if (debugLogs) {
        // eslint-disable-next-line no-console
        console.log(`[PlanetLife] seedAtPoint pattern=${seedPattern} offsets=${offsets.length}`);
      }

      sim.seedAtPoint({
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
      simRef,
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
