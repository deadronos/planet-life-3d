import { useMemo } from 'react';
import { Stars } from '@react-three/drei';
import { NebulaSkybox } from './NebulaSkybox';
import { DistantMoons } from './DistantMoons';
import { DistantSun } from './DistantSun';
import { SunLensFlare } from './SunLensFlare';

interface SpaceEnvironmentProps {
  lightPosition?: [number, number, number];
}

/**
 * Complete space environment with nebula skybox, stars, orbiting moons, sun, and lens flare.
 */
export function SpaceEnvironment({ lightPosition = [6, 6, 8] }: SpaceEnvironmentProps) {
  // Position the sun far away in the direction of the light (scaled up by 10x)
  const sunPosition = useMemo<[number, number, number]>(
    () => [lightPosition[0] * 10, lightPosition[1] * 10, lightPosition[2] * 10],
    [lightPosition],
  );

  return (
    <group>
      {/* Procedural nebula skybox */}
      <NebulaSkybox />

      {/* Starfield layer */}
      <Stars radius={80} depth={30} count={3000} factor={4} fade speed={0.3} />

      {/* Distant orbiting moons */}
      <DistantMoons />

      {/* Distant sun - visible source for the lens flare */}
      <DistantSun position={sunPosition} size={12} />

      {/* Sun lens flare from directional light */}
      <SunLensFlare lightPosition={lightPosition} />
    </group>
  );
}
