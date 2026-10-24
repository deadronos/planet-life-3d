import { describe, expect, it } from 'vitest';

import { type SeedingSlice } from '../../src/components/planetLife/controls';
import { resolveSeedRequest } from '../../src/components/planetLife/seedRequest';
import { BUILTIN_PATTERN_NAMES, getBuiltinPatternOffsets } from '../../src/sim/patterns';
import { buildRandomDiskOffsets } from '../../src/sim/utils';

const base: SeedingSlice = {
  seedMode: 'set',
  seedPattern: 'Glider',
  seedScale: 2,
  seedJitter: 0,
  seedProbability: 0.7,
  customPattern: '',
};

describe('resolveSeedRequest', () => {
  describe('Probe', () => {
    it('never seeds', () => {
      expect(resolveSeedRequest({ tool: 'Probe', seeding: base })).toBeNull();
    });
  });

  describe('meteor tools', () => {
    it('Sterilizer clears a disk with scale max(3, seedScale + 2) and probability 1', () => {
      const req = resolveSeedRequest({ tool: 'Sterilizer', seeding: { ...base, seedScale: 1 } });
      expect(req).toEqual({
        offsets: buildRandomDiskOffsets(3),
        mode: 'clear',
        scale: 1,
        jitter: 0,
        probability: 1,
      });
    });

    it('Sterilizer uses seedScale + 2 when that exceeds 3', () => {
      const req = resolveSeedRequest({ tool: 'Sterilizer', seeding: { ...base, seedScale: 4 } });
      expect(req?.offsets).toEqual(buildRandomDiskOffsets(6));
    });

    it('Mutation randomises a disk of radius 3 at probability 0.55 with jitter at least 1', () => {
      const req = resolveSeedRequest({ tool: 'Mutation', seeding: { ...base, seedJitter: 0 } });
      expect(req).toEqual({
        offsets: buildRandomDiskOffsets(3),
        mode: 'random',
        scale: 1,
        jitter: 1,
        probability: 0.55,
      });
    });

    it('Mutation keeps a larger jitter from the panel', () => {
      const req = resolveSeedRequest({ tool: 'Mutation', seeding: { ...base, seedJitter: 4 } });
      expect(req?.jitter).toBe(4);
    });

    it('Comet sets a disk of seedScale at probability 0.95, ignoring the panel probability', () => {
      const req = resolveSeedRequest({ tool: 'Comet', seeding: { ...base, seedScale: 2 } });
      expect(req).toEqual({
        offsets: buildRandomDiskOffsets(2),
        mode: 'set',
        scale: 1,
        jitter: 0,
        probability: 0.95,
      });
    });
  });

  describe('Life', () => {
    it('Random Disk builds offsets at seedScale and uses scale 1', () => {
      const req = resolveSeedRequest({
        tool: 'Life',
        seeding: { ...base, seedPattern: 'Random Disk', seedScale: 3, seedMode: 'toggle' },
      });
      expect(req).toEqual({
        offsets: buildRandomDiskOffsets(3),
        mode: 'toggle',
        scale: 1,
        jitter: 0,
        probability: 0.7,
      });
    });

    it('Custom ASCII parses the custom pattern and keeps the seed scale', () => {
      const req = resolveSeedRequest({
        tool: 'Life',
        seeding: { ...base, seedPattern: 'Custom ASCII', customPattern: '.O.\nOOO\n.O.' },
      });
      expect(req?.offsets.length).toBe(5);
      expect(req?.scale).toBe(2);
    });

    it('Custom ASCII with an empty pattern yields empty offsets', () => {
      const req = resolveSeedRequest({
        tool: 'Life',
        seeding: { ...base, seedPattern: 'Custom ASCII', customPattern: '' },
      });
      expect(req?.offsets).toEqual([]);
    });

    it.each(BUILTIN_PATTERN_NAMES)(
      'builtin pattern %s uses its offsets and the seed scale',
      (name) => {
        const req = resolveSeedRequest({
          tool: 'Life',
          seeding: { ...base, seedPattern: name, seedScale: 3, seedJitter: 2 },
        });
        expect(req).toEqual({
          offsets: getBuiltinPatternOffsets(name),
          mode: 'set',
          scale: 3,
          jitter: 2,
          probability: 0.7,
        });
      },
    );
  });
});
