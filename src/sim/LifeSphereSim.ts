import * as THREE from 'three';
import type { Offset } from './patterns';

export type SeedMode = 'set' | 'toggle' | 'clear' | 'random';

export type Rules = {
  birth: boolean[]; // length 9, indexed by neighbor count
  survive: boolean[]; // length 9
};

/**
 * Parses rule digits like "3" or "23" into a boolean lookup table indexed by neighbor count [0..8].
 *
 * Defensive: some UI libs can momentarily hand back numbers/undefined while editing.
 */
export function parseRuleDigits(digits: unknown): boolean[] {
  let s = '';
  if (typeof digits === 'string') s = digits;
  else if (typeof digits === 'number' && Number.isFinite(digits)) s = String(digits);
  const arr = Array.from({ length: 9 }, () => false);
  for (const ch of s) {
    const n = ch.charCodeAt(0) - 48;
    if (n >= 0 && n <= 8) arr[n] = true;
  }
  return arr;
}

function clampInt(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function safeInt(v: unknown, fallback: number, lo: number, hi: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return clampInt(Math.floor(n), lo, hi);
}

function safeFloat(v: unknown, fallback: number, lo: number, hi: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

export class LifeSphereSim {
  readonly latCells: number;
  readonly lonCells: number;
  readonly cellCount: number;

  private grid: Uint8Array;
  private next: Uint8Array;
  private rules: Rules;

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
    // Defensive: UI controllers can temporarily produce NaN/undefined during edits.
    // Clamp to keep memory usage sane and avoid RangeError: Invalid array length.
    this.latCells = safeInt(opts.latCells, 48, 4, 256);
    this.lonCells = safeInt(opts.lonCells, 96, 4, 512);
    this.cellCount = this.latCells * this.lonCells;

    this.grid = new Uint8Array(this.cellCount);
    this.next = new Uint8Array(this.cellCount);
    this.rules = opts.rules;

    this.normals = new Array<THREE.Vector3>(this.cellCount);
    this.positions = new Array<THREE.Vector3>(this.cellCount);

    const R = safeFloat(opts.planetRadius, 2.6, 0.1, 100);
    const lift = safeFloat(opts.cellLift, 0.04, 0, 10);
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

  setRules(rules: Rules) {
    this.rules = rules;
  }

  getCell(lat: number, lon: number): 0 | 1 {
    const la = clampInt(lat, 0, this.latCells - 1);
    const lo = ((lon % this.lonCells) + this.lonCells) % this.lonCells;
    return this.grid[la * this.lonCells + lo] as 0 | 1;
  }

  setCell(lat: number, lon: number, value: 0 | 1) {
    const la = clampInt(lat, 0, this.latCells - 1);
    const lo = ((lon % this.lonCells) + this.lonCells) % this.lonCells;
    this.grid[la * this.lonCells + lo] = value;
  }

  clear() {
    this.grid.fill(0);
    this.next.fill(0);
  }

  randomize(density: number, rng = Math.random) {
    const p = Math.max(0, Math.min(1, density));
    for (let i = 0; i < this.cellCount; i++) {
      this.grid[i] = rng() < p ? 1 : 0;
    }
  }

  /** Single simulation tick */
  step() {
    const L = this.latCells;
    const W = this.lonCells;
    const { birth, survive } = this.rules;

    for (let la = 0; la < L; la++) {
      const row = la * W;
      for (let lo = 0; lo < W; lo++) {
        let neighbors = 0;
        for (let dLa = -1; dLa <= 1; dLa++) {
          const nla = la + dLa;
          if (nla < 0 || nla >= L) continue;
          const nrow = nla * W;
          for (let dLo = -1; dLo <= 1; dLo++) {
            if (dLa === 0 && dLo === 0) continue;
            const nlo = (lo + dLo + W) % W;
            neighbors += this.grid[nrow + nlo];
          }
        }

        const idx = row + lo;
        const alive = this.grid[idx] === 1;
        this.next[idx] = alive ? (survive[neighbors] ? 1 : 0) : birth[neighbors] ? 1 : 0;
      }
    }

    // swap
    const tmp = this.grid;
    this.grid = this.next;
    this.next = tmp;
  }

  /** Map a world point on/near the planet to the nearest [lat, lon] cell index */
  pointToCell(point: THREE.Vector3): { lat: number; lon: number } {
    const n = point.clone().normalize();
    const latRad = Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)); // [-pi/2..pi/2]
    const lonRad = Math.atan2(n.z, n.x); // [-pi..pi]
    const latT = (latRad + Math.PI / 2) / Math.PI;
    const lonT = (lonRad + Math.PI) / (Math.PI * 2);

    const lat = Math.round(latT * (this.latCells - 1));
    const lon =
      ((Math.round(lonT * this.lonCells) % this.lonCells) + this.lonCells) % this.lonCells;
    return { lat, lon };
  }

  seedAtCell(params: {
    lat: number;
    lon: number;
    offsets: Offset[];
    mode: SeedMode;
    scale: number;
    jitter: number;
    probability: number;
    rng?: () => number;
  }) {
    // console.log('[LifeSphereSim] seedAtCell', { lat: params.lat, lon: params.lon, mode: params.mode, offsets: params.offsets.length });
    const rng = params.rng ?? Math.random;
    const scale = Math.max(1, Math.floor(params.scale));
    const jitter = Math.max(0, Math.floor(params.jitter));
    const p = Math.max(0, Math.min(1, params.probability));

    for (const [dLa0, dLo0] of params.offsets) {
      let dLa = dLa0 * scale;
      let dLo = dLo0 * scale;

      if (jitter > 0) {
        dLa += Math.floor((rng() * 2 - 1) * jitter);
        dLo += Math.floor((rng() * 2 - 1) * jitter);
      }

      const la = clampInt(params.lat + dLa, 0, this.latCells - 1);
      const lo = (((params.lon + dLo) % this.lonCells) + this.lonCells) % this.lonCells;
      const idx = la * this.lonCells + lo;

      switch (params.mode) {
        case 'set':
          this.grid[idx] = 1;
          break;
        case 'clear':
          this.grid[idx] = 0;
          break;
        case 'toggle':
          this.grid[idx] = this.grid[idx] ? 0 : 1;
          break;
        case 'random':
          this.grid[idx] = rng() < p ? 1 : 0;
          break;
      }
    }
    // console.log('[LifeSphereSim] seedAtCell finished. Affected cells:', affected);
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
  }) {
    const { lat, lon } = this.pointToCell(params.point);
    // eslint-disable-next-line no-console
    console.log(
      `[LifeSphereSim] seedAtPoint: point=${params.point
        .toArray()
        .map((v) => v.toFixed(2))
        .join(',')} -> cell=[${lat}, ${lon}]`,
    );
    this.seedAtCell({ ...params, lat, lon });
  }

  /** Iterate alive cells (for rendering) */
  forEachAlive(fn: (idx: number) => void) {
    for (let i = 0; i < this.cellCount; i++) {
      if (this.grid[i]) fn(i);
    }
  }

  /** Read-only view of the grid (0/1 per cell). Useful for texture-based rendering. */
  getGridView(): Uint8Array {
    return this.grid;
  }
}
