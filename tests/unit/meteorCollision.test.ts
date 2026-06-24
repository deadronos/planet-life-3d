import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { intersectPlanetShell, MAX_METEOR_DT_SECONDS } from '../../src/components/meteorCollision';

describe('intersectPlanetShell', () => {
  const planetRadius = 2.6;
  const meteorRadius = 0.08;

  it('reports a hit when a fast meteor teleports past the shell in one frame', () => {
    // Frame: meteor at (0, 0, 5) moves to (0, 0, -5) — a 10-unit jump that
    // passes straight through the 2.6-radius planet. The old point-in-sphere
    // check missed this and let the meteor fly off.
    const prev = new THREE.Vector3(0, 0, 5);
    const next = new THREE.Vector3(0, 0, -5);
    const scratch = new THREE.Vector3();

    const result = intersectPlanetShell({
      prev,
      next,
      planetRadius,
      meteorRadius,
      scratch,
    });

    expect(result.hit).toBe(true);
    // Impact point should land on the planet surface (|point| == planetRadius).
    expect(result.point.length()).toBeCloseTo(planetRadius, 5);
    // The entry point is where the segment *first* enters the shell.
    // For a segment passing straight through the origin (z: 5 -> -5), the
    // entry is on the +z side of the planet. The exit is on -z. The smallest
    // non-negative root is the entry, so we expect z > 0.
    expect(result.point.z).toBeGreaterThan(0);
    // t should be in [0, 1] and the closest positive root.
    expect(result.normalizedT).toBeGreaterThanOrEqual(0);
    expect(result.normalizedT).toBeLessThanOrEqual(1);
  });

  it('returns no hit when the segment is well outside the planet', () => {
    const prev = new THREE.Vector3(10, 0, 0);
    const next = new THREE.Vector3(9, 0, 0);
    const scratch = new THREE.Vector3();

    const result = intersectPlanetShell({
      prev,
      next,
      planetRadius,
      meteorRadius,
      scratch,
    });

    expect(result.hit).toBe(false);
  });

  it('returns no hit when the segment is in front of the sphere (both roots negative)', () => {
    // Segment moves away from the sphere and both quadratic roots are negative.
    const prev = new THREE.Vector3(5, 0, 0);
    const next = new THREE.Vector3(6, 0, 0);
    const scratch = new THREE.Vector3();

    const result = intersectPlanetShell({
      prev,
      next,
      planetRadius,
      meteorRadius,
      scratch,
    });

    expect(result.hit).toBe(false);
  });

  it('reports a hit when the segment starts inside the planet', () => {
    // Start inside (1, 0, 0), step outward along +x. The first surface
    // contact along this direction is the entry at t=0 (we're already in),
    // projected back to the planet surface at (planetRadius, 0, 0).
    const prev = new THREE.Vector3(1, 0, 0);
    const next = new THREE.Vector3(2, 0, 0);
    const scratch = new THREE.Vector3();

    const result = intersectPlanetShell({
      prev,
      next,
      planetRadius,
      meteorRadius,
      scratch,
    });

    expect(result.hit).toBe(true);
    expect(result.normalizedT).toBe(0);
    expect(result.point.length()).toBeCloseTo(planetRadius, 5);
  });

  it('returns no hit when the segment ends before reaching the sphere', () => {
    // Segment is between r and r+step but the closest approach is still > r.
    const prev = new THREE.Vector3(5, 0, 0);
    const next = new THREE.Vector3(4, 0, 0);
    const scratch = new THREE.Vector3();

    const result = intersectPlanetShell({
      prev,
      next,
      planetRadius,
      meteorRadius,
      scratch,
    });

    expect(result.hit).toBe(false);
  });

  it('handles a zero-length segment by reporting hit if start is inside', () => {
    const prev = new THREE.Vector3(1, 0, 0);
    const next = new THREE.Vector3(1, 0, 0);
    const scratch = new THREE.Vector3();

    const result = intersectPlanetShell({
      prev,
      next,
      planetRadius,
      meteorRadius,
      scratch,
    });

    expect(result.hit).toBe(true);
  });

  it('handles a zero-length segment outside the sphere', () => {
    const prev = new THREE.Vector3(10, 0, 0);
    const next = new THREE.Vector3(10, 0, 0);
    const scratch = new THREE.Vector3();

    const result = intersectPlanetShell({
      prev,
      next,
      planetRadius,
      meteorRadius,
      scratch,
    });

    expect(result.hit).toBe(false);
  });

  it('respects the meteor radius (shell extends past planetRadius)', () => {
    // Meteor at (3, 0, 0) moving to (2.55, 0, 0). Without the meteor radius
    // the segment wouldn't touch the planet shell; with it, it grazes the
    // shell (radius 2.68) at 2.55 < 2.68.
    const prev = new THREE.Vector3(3, 0, 0);
    const next = new THREE.Vector3(2.55, 0, 0);
    const scratch = new THREE.Vector3();

    const result = intersectPlanetShell({
      prev,
      next,
      planetRadius,
      meteorRadius,
      scratch,
    });

    expect(result.hit).toBe(true);
    expect(result.point.length()).toBeCloseTo(planetRadius, 5);
  });

  it('exposes a reasonable MAX_METEOR_DT_SECONDS cap', () => {
    // The cap is what prevents the tunneling bug. Keep it bounded — anything
    // bigger than ~50ms risks letting a fast meteor skip the shell.
    expect(MAX_METEOR_DT_SECONDS).toBeGreaterThan(0);
    expect(MAX_METEOR_DT_SECONDS).toBeLessThanOrEqual(1 / 20);
  });
});
