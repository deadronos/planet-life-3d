import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { computeImpactBasis } from '../../src/components/impactTypes';

describe('computeImpactBasis', () => {
  it('computes position and quaternion aligning +Z with normal (1,0,0)', () => {
    const normal = new THREE.Vector3(1, 0, 0);
    const planetRadius = 10;

    const { q, pos } = computeImpactBasis(normal, planetRadius);

    // Position should be normal * (radius + 0.01)
    expect(pos.x).toBeCloseTo(planetRadius + 0.01, 6);
    expect(pos.y).toBeCloseTo(0, 6);
    expect(pos.z).toBeCloseTo(0, 6);

    // Quaternion should rotate +Z into the normal direction
    const z = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    // z should be approximately equal to normal (unit length)
    expect(z.x).toBeCloseTo(normal.x, 6);
    expect(z.y).toBeCloseTo(normal.y, 6);
    expect(z.z).toBeCloseTo(normal.z, 6);
  });

  it('works for north pole normal (0,1,0)', () => {
    const normal = new THREE.Vector3(0, 1, 0);
    const planetRadius = 3.5;

    const { q, pos } = computeImpactBasis(normal, planetRadius);

    expect(pos.x).toBeCloseTo(0, 6);
    expect(pos.y).toBeCloseTo(planetRadius + 0.01, 6);
    expect(pos.z).toBeCloseTo(0, 6);

    const z = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    expect(z.x).toBeCloseTo(normal.x, 6);
    expect(z.y).toBeCloseTo(normal.y, 6);
    expect(z.z).toBeCloseTo(normal.z, 6);
  });
});
