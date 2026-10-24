import { getBuiltinPatternOffsets, type Offset, parseAsciiPattern } from '../../sim/patterns';
import type { SeedMode } from '../../sim/types';
import { buildRandomDiskOffsets } from '../../sim/utils';
import type { MeteorTool } from '../../store/useUIStore';
import type { SeedingSlice } from './controls';

/** Active tool as seen by the seeding pipeline (`Life` seeds from the Seeding panel). */
export type SeedTool = MeteorTool;

/**
 * Fully-resolved seed: everything `applySeed` needs, independent of whether the
 * GPU or CPU sim consumes it. `scale` is already final: disks are built at
 * their final radius and therefore carry scale 1.
 */
export type SeedRequest = {
  offsets: Offset[];
  mode: SeedMode;
  scale: number;
  jitter: number;
  probability: number;
};

/**
 * Resolve what a click on the planet should seed.
 *
 * - `Probe` never seeds (returns null).
 * - Meteor tools (Sterilizer / Mutation / Comet) always seed a filled disk with
 *   fixed mode/probability; returns null when the disk is empty.
 * - `Life` seeds from the Seeding panel's pattern (Random Disk / Custom ASCII /
 *   builtin). Empty patterns are returned as-is so callers keep their existing
 *   empty-pattern handling.
 */
export function resolveSeedRequest({
  tool,
  seeding,
}: {
  tool: SeedTool;
  seeding: SeedingSlice;
}): SeedRequest | null {
  if (tool === 'Probe') return null;
  if (tool === 'Life') return resolveLifeSeed(seeding);
  return resolveToolSeed(tool, seeding);
}

function resolveToolSeed(
  tool: Exclude<SeedTool, 'Life' | 'Probe'>,
  { seedScale, seedJitter, seedProbability }: SeedingSlice,
): SeedRequest | null {
  const toolScale =
    tool === 'Sterilizer' ? Math.max(3, seedScale + 2) : tool === 'Mutation' ? 3 : seedScale;
  // Sterilizer/Mutation/Comet have fixed seeding semantics.
  const mode: SeedMode = tool === 'Sterilizer' ? 'clear' : tool === 'Mutation' ? 'random' : 'set';
  const probability =
    tool === 'Sterilizer'
      ? 1
      : tool === 'Mutation'
        ? 0.55
        : tool === 'Comet'
          ? 0.95
          : seedProbability;

  // Tool meteors always use a filled disk. It is built at its final radius, so
  // scale is 1: the transform must not scale the offsets a second time.
  const offsets = buildRandomDiskOffsets(toolScale);
  if (offsets.length === 0) return null;

  return {
    offsets,
    mode,
    scale: 1,
    jitter: tool === 'Mutation' ? Math.max(1, seedJitter) : seedJitter,
    probability,
  };
}

function resolveLifeSeed({
  seedPattern,
  seedScale,
  seedMode,
  seedJitter,
  seedProbability,
  customPattern,
}: SeedingSlice): SeedRequest {
  if (seedPattern === 'Random Disk') {
    return {
      offsets: buildRandomDiskOffsets(seedScale),
      mode: seedMode,
      // Disk offsets are built at their final radius; scaling again would make
      // the radius quadratic in seedScale.
      scale: 1,
      jitter: seedJitter,
      probability: seedProbability,
    };
  }

  const offsets =
    seedPattern === 'Custom ASCII'
      ? parseAsciiPattern(customPattern)
      : getBuiltinPatternOffsets(seedPattern);

  return {
    offsets,
    mode: seedMode,
    scale: seedScale,
    jitter: seedJitter,
    probability: seedProbability,
  };
}
