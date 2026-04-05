import * as THREE from 'three';

export interface AtmosphereProps {
  planetRadius: number;
  atmosphereColor: string;
  atmosphereIntensity: number;
  atmosphereHeight: number;
}

export function Atmosphere({
  planetRadius,
  atmosphereColor,
  atmosphereIntensity,
  atmosphereHeight,
}: AtmosphereProps) {
  return (
    <mesh raycast={() => null}>
      <sphereGeometry args={[planetRadius * (1 + atmosphereHeight), 64, 64]} />
      <meshBasicMaterial
        color={atmosphereColor}
        transparent
        opacity={Math.max(0, atmosphereIntensity) * 0.35}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.BackSide}
      />
    </mesh>
  );
}
