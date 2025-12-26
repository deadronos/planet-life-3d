import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { computeMeteorState } from '../../src/components/Meteor';

describe('computeMeteorState', () => {
  it('clones origin and normalizes direction', () => {
    const origin = new THREE.Vector3(2, 0, 0);
    const direction = new THREE.Vector3(1, 1, 0);

    const s = computeMeteorState(origin, direction);

    // origin is cloned
    expect(s.pos).not.toBe(origin);
    expect(s.pos.x).toBeCloseTo(origin.x);

    // direction is normalized
    const len = Math.sqrt(1 * 1 + 1 * 1);
    expect(s.dir.x).toBeCloseTo(1 / len);
    expect(s.dir.y).toBeCloseTo(1 / len);
    expect(s.dir.z).toBeCloseTo(0);
  });

  it('normalizes an already unit direction without changing it', () => {
    const origin = new THREE.Vector3(0, 0, 0);
    const direction = new THREE.Vector3(0, 1, 0);
    const s = computeMeteorState(origin, direction);

    expect(s.dir.x).toBeCloseTo(0);
    expect(s.dir.y).toBeCloseTo(1);
    expect(s.dir.z).toBeCloseTo(0);
  });
});
