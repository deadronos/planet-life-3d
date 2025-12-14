import * as THREE from 'three';
import type { Offset } from './patterns';
import type { Rules } from './rules';
import { clampInt, safeFloat, safeInt } from './utils';

export type SeedMode = 'set' | 'toggle' | 'clear' | 'random';

export class LifeSphereSim {
  readonly latCells: number;
  readonly lonCells: number;
  readonly cellCount: number;

  private grid: Uint8Array;
  private next: Uint8Array;
  private age: Uint8Array;
  private ageNext: Uint8Array;
  private neighborHeat: Uint8Array;
  private neighborHeatNext: Uint8Array;
  private rules: Rules;

  // Stats
  generation = 0;
  population = 0;
  birthsLastTick = 0;
  deathsLastTick = 0;

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
    this.age = new Uint8Array(this.cellCount);
    this.ageNext = new Uint8Array(this.cellCount);
    this.neighborHeat = new Uint8Array(this.cellCount);
    this.neighborHeatNext = new Uint8Array(this.cellCount);
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
    const idx = la * this.lonCells + lo;
    this.grid[idx] = value;
    this.age[idx] = value ? 1 : 0;
    this.neighborHeat[idx] = 0;
  }

  clear() {
    this.grid.fill(0);
    this.next.fill(0);
    this.age.fill(0);
    this.ageNext.fill(0);
    this.neighborHeat.fill(0);
    this.neighborHeatNext.fill(0);
  }

  randomize(density: number, rng = Math.random) {
    const p = Math.max(0, Math.min(1, density));
    for (let i = 0; i < this.cellCount; i++) {
      const alive = rng() < p ? 1 : 0;
      this.grid[i] = alive;
      this.age[i] = alive ? 1 : 0;
      this.neighborHeat[i] = 0;
    }
  }

  /** Single simulation tick */
  step() {
    const L = this.latCells;
    const W = this.lonCells;
    const { birth, survive } = this.rules;

    let births = 0;
    let deaths = 0;
    let pop = 0;

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
        const nextAlive = alive ? (survive[neighbors] ? 1 : 0) : birth[neighbors] ? 1 : 0;

        if (!alive && nextAlive) births++;
        if (alive && !nextAlive) deaths++;
        if (nextAlive) pop++;

        this.next[idx] = nextAlive;
        this.ageNext[idx] = nextAlive ? Math.min(255, (alive ? this.age[idx] : 0) + 1) : 0;
        this.neighborHeatNext[idx] = nextAlive ? neighbors : 0;
      }
    }

    this.birthsLastTick = births;
    this.deathsLastTick = deaths;
    this.population = pop;
    this.generation++;

    // swap
    let tmp = this.grid;
    this.grid = this.next;
    this.next = tmp;

    tmp = this.age;
    this.age = this.ageNext;
    this.ageNext = tmp;

    tmp = this.neighborHeat;
    this.neighborHeat = this.neighborHeatNext;
    this.neighborHeatNext = tmp;
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
    debug?: boolean;
  }) {
    // console.log('[LifeSphereSim] seedAtCell', { lat: params.lat, lon: params.lon, mode: params.mode, offsets: params.offsets.length });
    const rng = params.rng ?? Math.random;
    const scale = Math.max(1, Math.floor(params.scale));
    const jitter = Math.max(0, Math.floor(params.jitter));
    const p = Math.max(0, Math.min(1, params.probability));

    if (params.debug) {
      // eslint-disable-next-line no-console
      console.log(
        `[LifeSphereSim] seedAtCell: mode=${params.mode} offsets=${params.offsets.length} scale=${scale} p=${p} jitter=${jitter}`,
      );
    }

    let affected = 0;
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
      const alive = this.grid[idx] === 1;
      this.age[idx] = alive ? 1 : 0;
      this.neighborHeat[idx] = 0;
      affected++;
    }
    if (params.debug) {
      // eslint-disable-next-line no-console
      console.log(`[LifeSphereSim] seedAtCell finished. Affected cells: ${affected}`);
    }
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
        `[LifeSphereSim] seedAtPoint: point=${params.point
          .toArray()
          .map((v) => v.toFixed(2))
          .join(',')} -> cell=[${lat}, ${lon}]`,
      );
    }
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

  /** Read-only view of ages (frames alive, clamped to 255) */
  getAgeView(): Uint8Array {
    return this.age;
  }

  /** Read-only view of neighbor counts for alive cells (0..8) */
  getNeighborHeatView(): Uint8Array {
    return this.neighborHeat;
  }
}
