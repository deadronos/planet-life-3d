import * as THREE from 'three';

/**
 * Result of a swept meteor collision test against a unit-origin sphere.
 *
 * - `hit` is `true` when the segment from `prev` to `next` entered the sphere.
 * - `point` is the world-space impact point on the planet surface
 *   (`|point| === planetRadius`) for the closest intersection along the segment.
 * - `normalizedT` is the parameter in [0, 1] along `prev -> next` where the
 *   impact occurs, useful for placing trails or particles.
 */
export type MeteorImpact = {
  hit: boolean;
  point: THREE.Vector3;
  normalizedT: number;
};

/**
 * Line-segment vs sphere intersection for meteor impact detection.
 *
 * The collision shell has radius `planetRadius + meteorRadius` (so the meteor
 * is considered to have "hit" once its body intersects the planet's solid
 * sphere). The returned `point` is then projected back onto the planet surface
 * (`|point| = planetRadius`) so seeds and impact rings use a clean surface
 * coordinate regardless of meteor size.
 *
 * Returns `hit: false` when the segment does not intersect the shell.
 */
export function intersectPlanetShell(params: {
  prev: THREE.Vector3;
  next: THREE.Vector3;
  planetRadius: number;
  meteorRadius: number;
  scratch: THREE.Vector3;
}): MeteorImpact {
  const { prev, next, planetRadius, meteorRadius, scratch } = params;
  const r = planetRadius + meteorRadius;
  const r2 = r * r;

  // Step vector from prev to next.
  const stepX = next.x - prev.x;
  const stepY = next.y - prev.y;
  const stepZ = next.z - prev.z;
  const stepLen2 = stepX * stepX + stepY * stepY + stepZ * stepZ;

  if (stepLen2 === 0) {
    // No motion this frame.
    return { hit: prev.lengthSq() <= r2, point: scratch.copy(prev), normalizedT: 0 };
  }

  // prev . step
  const dot = prev.x * stepX + prev.y * stepY + prev.z * stepZ;
  // prev . prev - r^2
  const prevLen2 = prev.x * prev.x + prev.y * prev.y + prev.z * prev.z;
  const c = prevLen2 - r2;

  // Quadratic: stepLen2 * t^2 + 2 * dot * t + c = 0
  // Discriminant: 4 * (dot^2 - stepLen2 * c)
  const disc = dot * dot - stepLen2 * c;
  if (disc < 0) {
    return { hit: false, point: scratch.set(0, 0, 0), normalizedT: 0 };
  }

  const sqrtDisc = Math.sqrt(disc);
  // We want the smallest non-negative t in [0, 1].
  // Two roots: (-dot ± sqrtDisc) / stepLen2
  const invStep = 1 / stepLen2;
  let t1 = (-dot - sqrtDisc) * invStep;
  let t2 = (-dot + sqrtDisc) * invStep;
  if (t1 > t2) {
    const tmp = t1;
    t1 = t2;
    t2 = tmp;
  }

  let t: number;
  if (t2 < 0) {
    // Both roots negative: segment is in front of the sphere.
    return { hit: false, point: scratch.set(0, 0, 0), normalizedT: 0 };
  }
  if (t1 >= 0) {
    t = t1;
  } else {
    // Segment starts inside the sphere and exits: impact at the entry point.
    t = 0;
  }
  if (t > 1) {
    return { hit: false, point: scratch.set(0, 0, 0), normalizedT: 0 };
  }

  const hitX = prev.x + stepX * t;
  const hitY = prev.y + stepY * t;
  const hitZ = prev.z + stepZ * t;

  // Project the impact back onto the planet surface so seeds and rings land
  // on the visible sphere, not the meteor's outer shell.
  const hitLen = Math.sqrt(hitX * hitX + hitY * hitY + hitZ * hitZ);
  if (hitLen === 0) {
    return { hit: true, point: scratch.set(0, 0, 0), normalizedT: t };
  }
  const k = planetRadius / hitLen;
  return { hit: true, point: scratch.set(hitX * k, hitY * k, hitZ * k), normalizedT: t };
}

/**
 * Maximum delta time (in seconds) that a single `useFrame` step is allowed
 * to integrate. Prevents meteors from teleporting past the planet during
 * long pauses (tab inactive, GC stalls, devtools throttling).
 */
export const MAX_METEOR_DT_SECONDS = 1 / 30;
