import { LifeSimBase } from './LifeSimBase';
import type { Rules } from './rules';

/**
 * Pure simulation core (typed arrays only).
 *
 * Notes:
 * - No three.js dependency (safe to run in a Web Worker).
 * - Latitude is clamped at poles; longitude wraps.
 * - Extends LifeSimBase for shared logic and optimized step().
 */
export class LifeGridSim extends LifeSimBase {
  constructor(opts: { latCells: number; lonCells: number; rules: Rules }) {
    super(opts);
  }
}
