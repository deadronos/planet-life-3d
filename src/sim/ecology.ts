export type EcologyProfileName =
  | 'None'
  | 'Garden World'
  | 'Harsh Mars'
  | 'Crystal Plague'
  | 'Meteor Garden';

export type EcologySample = {
  temperature: number;
  moisture: number;
  altitude: number;
  sunlight: number;
  fertility: number;
  viability: number;
  neighborBias: -1 | 0 | 1;
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

function wave(a: number, b: number, c: number): number {
  return (Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) + 1) * 0.5;
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
      biome: 'Temperate Cells',
    };
  }

  const latDenom = Math.max(1, params.latCells - 1);
  const lonDenom = Math.max(1, params.lonCells);
  const lat01 = params.lat / latDenom;
  const lon01 = params.lon / lonDenom;
  const equator = 1 - Math.abs(lat01 - 0.5) * 2;
  const ridge = wave(lat01 * 1.8, lon01 * 1.5, 0.13);
  const basin = wave(lat01 * 2.7 + 0.25, lon01 * 2.2, 0.61);

  const altitude = clamp01(ridge * 0.7 + wave(lat01 * 7.1, lon01 * 4.3, 0.29) * 0.3);
  const moisture = clamp01(
    basin * 0.6 +
      equator * 0.28 +
      profile.fertilityBias -
      profile.droughtBias -
      Math.max(0, altitude - 0.62) * 0.32,
  );
  const temperature = clamp01(equator * 0.78 + wave(lat01 * 2.2, lon01 * 0.7, 0.41) * 0.22);
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
    biome,
  };
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
