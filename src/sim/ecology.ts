export type EcologyProfileName =
  'None' | 'Garden World' | 'Harsh Mars' | 'Crystal Plague' | 'Meteor Garden';

export type EcologySample = {
  temperature: number;
  moisture: number;
  altitude: number;
  sunlight: number;
  fertility: number;
  viability: number;
  neighborBias: -1 | 0 | 1;
  /**
   * Complementary Colony species habitat preference:
   *  +1 = warm/wet lowlands (favors Colony A),
   *  -1 = cold/highland ridges (favors Colony B),
   *   0 = neutral transition zone.
   */
  colonyAffinity: -1 | 0 | 1;
  biome: string;
};

export type EcologyProfile = {
  name: EcologyProfileName;
  fertilityBias: number;
  droughtBias: number;
  mountainBias: number;
  sunlightBias: number;
};

export const ECOLOGY_PROFILES: Record<EcologyProfileName, EcologyProfile> = {
  None: {
    name: 'None',
    fertilityBias: 0,
    droughtBias: 0,
    mountainBias: 0,
    sunlightBias: 0,
  },
  'Garden World': {
    name: 'Garden World',
    fertilityBias: 0.2,
    droughtBias: -0.1,
    mountainBias: -0.05,
    sunlightBias: 0.08,
  },
  'Harsh Mars': {
    name: 'Harsh Mars',
    fertilityBias: -0.2,
    droughtBias: 0.28,
    mountainBias: 0.12,
    sunlightBias: -0.05,
  },
  'Crystal Plague': {
    name: 'Crystal Plague',
    fertilityBias: 0.04,
    droughtBias: 0.08,
    mountainBias: -0.18,
    sunlightBias: -0.03,
  },
  'Meteor Garden': {
    name: 'Meteor Garden',
    fertilityBias: 0.16,
    droughtBias: 0.02,
    mountainBias: 0,
    sunlightBias: 0.04,
  },
};

export const ECOLOGY_PROFILE_NAMES = Object.keys(ECOLOGY_PROFILES) as EcologyProfileName[];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function mod289(x: number): number {
  return x - Math.floor(x * (1 / 289)) * 289;
}

function permute(x: number): number {
  return mod289((x * 34 + 1) * x);
}

function taylorInvSqrt(r: number): number {
  return 1.79284291400159 - 0.85373472095314 * r;
}

/**
 * 3D Simplex noise matching `SNOISE_3D_GLSL` in `src/shaders/planetNoiseBake.ts`
 * so ecology biomes and CA viability align seamlessly across the sphere.
 */
function snoise3D(vx: number, vy: number, vz: number): number {
  const C1 = 1 / 6;
  const C2 = 1 / 3;
  const s = (vx + vy + vz) * C2;
  const ix = Math.floor(vx + s);
  const iy = Math.floor(vy + s);
  const iz = Math.floor(vz + s);
  const t = (ix + iy + iz) * C1;
  const x0x = vx - ix + t;
  const x0y = vy - iy + t;
  const x0z = vz - iz + t;

  const gx = x0y <= x0x ? 1 : 0;
  const gy = x0z <= x0y ? 1 : 0;
  const gz = x0x <= x0z ? 1 : 0;
  const lx = 1 - gx;
  const ly = 1 - gy;
  const lz = 1 - gz;

  const i1x = Math.min(gx, lz);
  const i1y = Math.min(gy, lx);
  const i1z = Math.min(gz, ly);
  const i2x = Math.max(gx, lz);
  const i2y = Math.max(gy, lx);
  const i2z = Math.max(gz, ly);

  const x1x = x0x - i1x + C1;
  const x1y = x0y - i1y + C1;
  const x1z = x0z - i1z + C1;
  const x2x = x0x - i2x + C2;
  const x2y = x0y - i2y + C2;
  const x2z = x0z - i2z + C2;
  const x3x = x0x - 0.5;
  const x3y = x0y - 0.5;
  const x3z = x0z - 0.5;

  const mx = mod289(ix);
  const my = mod289(iy);
  const mz = mod289(iz);

  const p0 = permute(permute(permute(mz) + my) + mx);
  const p1 = permute(permute(permute(mz + i1z) + my + i1y) + mx + i1x);
  const p2 = permute(permute(permute(mz + i2z) + my + i2y) + mx + i2x);
  const p3 = permute(permute(permute(mz + 1) + my + 1) + mx + 1);

  const n_ = 0.142857142857;
  const nsx = n_ * 2 - 0;
  const nsy = n_ * 0.5 - 1;
  const nsz = n_ * 1 - 0;

  const nszz = nsz * nsz;
  const j0 = p0 - 49 * Math.floor(p0 * nszz);
  const j1 = p1 - 49 * Math.floor(p1 * nszz);
  const j2 = p2 - 49 * Math.floor(p2 * nszz);
  const j3 = p3 - 49 * Math.floor(p3 * nszz);

  const x_0 = Math.floor(j0 * nsz);
  const x_1 = Math.floor(j1 * nsz);
  const x_2 = Math.floor(j2 * nsz);
  const x_3 = Math.floor(j3 * nsz);
  const y_0 = Math.floor(j0 - 7 * x_0);
  const y_1 = Math.floor(j1 - 7 * x_1);
  const y_2 = Math.floor(j2 - 7 * x_2);
  const y_3 = Math.floor(j3 - 7 * x_3);

  const fx0 = x_0 * nsx + nsy;
  const fx1 = x_1 * nsx + nsy;
  const fx2 = x_2 * nsx + nsy;
  const fx3 = x_3 * nsx + nsy;
  const fy0 = y_0 * nsx + nsy;
  const fy1 = y_1 * nsx + nsy;
  const fy2 = y_2 * nsx + nsy;
  const fy3 = y_3 * nsx + nsy;

  const h0 = 1 - Math.abs(fx0) - Math.abs(fy0);
  const h1 = 1 - Math.abs(fx1) - Math.abs(fy1);
  const h2 = 1 - Math.abs(fx2) - Math.abs(fy2);
  const h3 = 1 - Math.abs(fx3) - Math.abs(fy3);

  const b0x = fx0;
  const b0y = fx1;
  const b0z = fy0;
  const b0w = fy1;
  const b1x = fx2;
  const b1y = fx3;
  const b1z = fy2;
  const b1w = fy3;

  const s0x = Math.floor(b0x) * 2 + 1;
  const s0y = Math.floor(b0y) * 2 + 1;
  const s0z = Math.floor(b0z) * 2 + 1;
  const s0w = Math.floor(b0w) * 2 + 1;
  const s1x = Math.floor(b1x) * 2 + 1;
  const s1y = Math.floor(b1y) * 2 + 1;
  const s1z = Math.floor(b1z) * 2 + 1;
  const s1w = Math.floor(b1w) * 2 + 1;

  const sh0 = h0 < 0 ? -1 : 0;
  const sh1 = h1 < 0 ? -1 : 0;
  const sh2 = h2 < 0 ? -1 : 0;
  const sh3 = h3 < 0 ? -1 : 0;

  const a0x = b0x + s0x * sh0;
  const a0y = b0z + s0z * sh0;
  const a0z = b0y + s0y * sh1;
  const a0w = b0w + s0w * sh1;
  const a1x = b1x + s1x * sh2;
  const a1y = b1z + s1z * sh2;
  const a1z = b1y + s1y * sh3;
  const a1w = b1w + s1w * sh3;

  let p0x = a0x;
  let p0y = a0y;
  let p0z = h0;
  let p1x = a0z;
  let p1y = a0w;
  let p1z = h1;
  let p2x = a1x;
  let p2y = a1y;
  let p2z = h2;
  let p3x = a1z;
  let p3y = a1w;
  let p3z = h3;

  const norm0 = taylorInvSqrt(p0x * p0x + p0y * p0y + p0z * p0z);
  const norm1 = taylorInvSqrt(p1x * p1x + p1y * p1y + p1z * p1z);
  const norm2 = taylorInvSqrt(p2x * p2x + p2y * p2y + p2z * p2z);
  const norm3 = taylorInvSqrt(p3x * p3x + p3y * p3y + p3z * p3z);
  p0x *= norm0;
  p0y *= norm0;
  p0z *= norm0;
  p1x *= norm1;
  p1y *= norm1;
  p1z *= norm1;
  p2x *= norm2;
  p2y *= norm2;
  p2z *= norm2;
  p3x *= norm3;
  p3y *= norm3;
  p3z *= norm3;

  const m0 = Math.max(0.6 - (x0x * x0x + x0y * x0y + x0z * x0z), 0);
  const m1 = Math.max(0.6 - (x1x * x1x + x1y * x1y + x1z * x1z), 0);
  const m2 = Math.max(0.6 - (x2x * x2x + x2y * x2y + x2z * x2z), 0);
  const m3 = Math.max(0.6 - (x3x * x3x + x3y * x3y + x3z * x3z), 0);

  const m0_4 = m0 * m0 * (m0 * m0);
  const m1_4 = m1 * m1 * (m1 * m1);
  const m2_4 = m2 * m2 * (m2 * m2);
  const m3_4 = m3 * m3 * (m3 * m3);

  return (
    42 *
    (m0_4 * (p0x * x0x + p0y * x0y + p0z * x0z) +
      m1_4 * (p1x * x1x + p1y * x1y + p1z * x1z) +
      m2_4 * (p2x * x2x + p2y * x2y + p2z * x2z) +
      m3_4 * (p3x * x3x + p3y * x3y + p3z * x3z))
  );
}

export function computeEcologySample(params: {
  lat: number;
  lon: number;
  latCells: number;
  lonCells: number;
  profile: EcologyProfileName;
}): EcologySample {
  const profile = ECOLOGY_PROFILES[params.profile] ?? ECOLOGY_PROFILES.None;
  if (profile.name === 'None') {
    return {
      temperature: 0.5,
      moisture: 0.5,
      altitude: 0,
      sunlight: 0.5,
      fertility: 0.5,
      viability: 0.5,
      neighborBias: 0,
      colonyAffinity: 0,
      biome: 'Temperate Cells',
    };
  }

  const latDenom = Math.max(1, params.latCells - 1);
  const lonDenom = Math.max(1, params.lonCells);
  const lat01 = params.lat / latDenom;
  const lon01 = params.lon / lonDenom;
  const latRad = (lat01 - 0.5) * Math.PI;
  const lonRad = (lon01 - 0.5) * Math.PI * 2;
  const cosLat = Math.cos(latRad);
  const dirX = cosLat * Math.cos(lonRad);
  const dirY = Math.sin(latRad);
  const dirZ = cosLat * Math.sin(lonRad);

  const px = dirX * 2.5;
  const py = dirY * 2.5;
  const pz = dirZ * 2.5;
  const basin = snoise3D(px * 2.2 + 3.1, py * 2.2 + 0.4, pz * 2.2 + 1.7) * 0.5 + 0.5;
  const ridge = snoise3D(px * 4.5 + 0.2, py * 4.5 + 2.8, pz * 4.5 + 1.1) * 0.5 + 0.5;

  const equator = 1 - Math.abs(dirY);
  const altitude = clamp01(ridge);
  const temperature = clamp01(equator * 0.78 + basin * 0.22);
  const moisture = clamp01(
    basin * 0.62 +
      equator * 0.24 -
      Math.max(0, ridge - 0.62) * 0.35 +
      profile.fertilityBias -
      profile.droughtBias,
  );
  const sunlight = clamp01(0.5 + Math.cos((lon01 - 0.18) * Math.PI * 2) * 0.3 + equator * 0.12);
  const fertility = clamp01(
    moisture * 0.42 +
      (1 - Math.abs(temperature - 0.58) * 1.6) * 0.32 +
      (1 - altitude) * 0.18 +
      profile.fertilityBias,
  );
  const viability = clamp01(
    fertility +
      sunlight * profile.sunlightBias -
      Math.max(0, 0.28 - moisture) * (0.9 + profile.droughtBias) -
      Math.max(0, altitude - 0.7) * (0.72 + profile.mountainBias),
  );

  const neighborBias: -1 | 0 | 1 = viability >= 0.68 ? 1 : viability <= 0.28 ? -1 : 0;
  const affinityScore =
    (temperature - 0.4) * 0.45 + (moisture - 0.5) * 0.2 + (0.5 - altitude) * 0.35;
  const colonyAffinity: -1 | 0 | 1 = affinityScore >= 0.08 ? 1 : affinityScore <= -0.08 ? -1 : 0;

  let biome = 'Temperate Belt';
  if (altitude > 0.74) biome = moisture > 0.45 ? 'Cloud Mountains' : 'Dry Highlands';
  else if (moisture < 0.24) biome = temperature > 0.48 ? 'Dust Desert' : 'Cold Steppe';
  else if (moisture > 0.72) biome = temperature > 0.52 ? 'Bloom Wetlands' : 'Ice Marsh';
  else if (fertility > 0.66) biome = 'Fertile Coast';
  else if (sunlight < 0.36) biome = 'Night Basin';

  return {
    temperature,
    moisture,
    altitude,
    sunlight,
    fertility,
    viability,
    neighborBias,
    colonyAffinity,
    biome,
  };
}

export function buildEcologyTables(
  latCells: number,
  lonCells: number,
  profile: EcologyProfileName,
): { bias: Int8Array; affinity: Int8Array } {
  const cellCount = latCells * lonCells;
  const bias = new Int8Array(cellCount);
  const affinity = new Int8Array(cellCount);
  const resolved = ECOLOGY_PROFILES[profile]?.name ?? 'None';
  if (resolved === 'None') return { bias, affinity };

  for (let lat = 0; lat < latCells; lat++) {
    const rowOffset = lat * lonCells;
    for (let lon = 0; lon < lonCells; lon++) {
      const sample = computeEcologySample({
        lat,
        lon,
        latCells,
        lonCells,
        profile: resolved,
      });
      bias[rowOffset + lon] = sample.neighborBias;
      affinity[rowOffset + lon] = sample.colonyAffinity;
    }
  }
  return { bias, affinity };
}

export function buildEcologyBiasTable(
  latCells: number,
  lonCells: number,
  profile: EcologyProfileName,
): Int8Array {
  return buildEcologyTables(latCells, lonCells, profile).bias;
}

export function adjustNeighborsForEcology(
  neighbors: number,
  lat: number,
  lon: number,
  latCells: number,
  lonCells: number,
  profile: EcologyProfileName,
): number {
  if (profile === 'None') return neighbors;
  const sample = computeEcologySample({ lat, lon, latCells, lonCells, profile });
  return Math.max(0, Math.min(8, neighbors + sample.neighborBias));
}
