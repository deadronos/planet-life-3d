import * as THREE from 'three';

import { SIM_CONSTRAINTS, SIM_DEFAULTS } from './constants';
import { LifeSimBase, type SeedMode } from './LifeSimBase';
import type { Offset } from './patterns';
import type { Rules } from './rules';
import { spherePointToCell } from './spherePointToCell';
import { formatVector3, safeFloat } from './utils';

export type { SeedMode };

export class LifeSphereSim extends LifeSimBase {
  // Precomputed surface positions (radius + lift), and normals
  readonly normals: THREE.Vector3[];
  readonly positions: THREE.Vector3[];

  constructor(opts: {
    latCells: number;
    lonCells: number;
    planetRadius: number;
    cellLift: number;
    rules: Rules;
  }) {
    super(opts);

    this.normals = new Array<THREE.Vector3>(this.cellCount);
    this.positions = new Array<THREE.Vector3>(this.cellCount);

    const R = safeFloat(
      opts.planetRadius,
      SIM_DEFAULTS.planetRadius,
      SIM_CONSTRAINTS.planetRadius.min,
      SIM_CONSTRAINTS.planetRadius.max,
    );
    const lift = safeFloat(
      opts.cellLift,
      SIM_DEFAULTS.cellLift,
      SIM_CONSTRAINTS.cellLift.min,
      SIM_CONSTRAINTS.cellLift.max,
    );
    // Lat: [-pi/2 .. +pi/2], Lon: [-pi .. +pi]
    for (let la = 0; la < this.latCells; la++) {
      const v = la / (this.latCells - 1);
      const lat = (v - 0.5) * Math.PI;
      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);

      for (let lo = 0; lo < this.lonCells; lo++) {
        const u = lo / this.lonCells;
        const lon = (u - 0.5) * Math.PI * 2;
        const cosLon = Math.cos(lon);
        const sinLon = Math.sin(lon);

        const nx = cosLat * cosLon;
        const ny = sinLat;
        const nz = cosLat * sinLon;

        const idx = la * this.lonCells + lo;
        const n = new THREE.Vector3(nx, ny, nz);
        this.normals[idx] = n;
        this.positions[idx] = n.clone().multiplyScalar(R + lift);
      }
    }
  }

  /** Map a world point on/near the planet to the nearest [lat, lon] cell index */
  pointToCell(point: THREE.Vector3): { lat: number; lon: number } {
    return spherePointToCell(point, this.latCells, this.lonCells);
  }

  /** Convenience: seed using a world impact point (e.g., meteor hit). */
  seedAtPoint(params: {
    point: THREE.Vector3;
    offsets: Offset[];
    mode: SeedMode;
    scale: number;
    jitter: number;
    probability: number;
    rng?: () => number;
    debug?: boolean;
  }) {
    const { lat, lon } = this.pointToCell(params.point);
    if (params.debug) {
      // eslint-disable-next-line no-console
      console.log(
        `[LifeSphereSim] seedAtPoint: point=${formatVector3(params.point)} -> cell=[${lat}, ${lon}]`,
      );
    }
    this.seedAtCell({ ...params, lat, lon });
  }
}
