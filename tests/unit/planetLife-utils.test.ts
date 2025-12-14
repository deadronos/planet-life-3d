import { describe, it, expect } from 'vitest';
import { uid } from '../../src/components/planetLife/utils';

describe('planetLife/utils', () => {
  describe('uid', () => {
    it('should generate a unique identifier with default prefix', () => {
      const id = uid();
      expect(id).toMatch(/^id-[a-f0-9]+-[a-f0-9]+$/);
    });

    it('should generate a unique identifier with custom prefix', () => {
      const id = uid('custom');
      expect(id).toMatch(/^custom-[a-f0-9]+-[a-f0-9]+$/);
    });

    it('should generate different IDs on subsequent calls', () => {
      const id1 = uid();
      const id2 = uid();
      expect(id1).not.toBe(id2);
    });

    it('should include timestamp component', () => {
      const id = uid();

      // ID should contain a hex timestamp
      const parts = id.split('-');
      expect(parts).toHaveLength(3);
      expect(parts[2]).toBeTruthy();
    });
  });
});
