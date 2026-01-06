import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

interface FlareElement {
  texture: THREE.Texture;
  size: number;
  distance: number;
  color: THREE.Color;
}

/**
 * Sun lens flare effect using sprite-based flare elements.
 * Positioned at the directional light source.
 */
export function SunLensFlare({
  lightPosition = [6, 6, 8],
}: {
  lightPosition?: [number, number, number];
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  // Create procedural flare textures
  const flareTextures = useMemo(() => {
    const createFlareTexture = (
      size: number,
      innerRadius: number,
      outerRadius: number,
      softness: number,
    ) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      const gradient = ctx.createRadialGradient(
        size / 2,
        size / 2,
        innerRadius * size,
        size / 2,
        size / 2,
        outerRadius * size,
      );
      gradient.addColorStop(0, `rgba(255, 255, 255, ${softness})`);
      gradient.addColorStop(0.5, `rgba(255, 200, 150, ${softness * 0.5})`);
      gradient.addColorStop(1, 'rgba(255, 100, 50, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    };

    return {
      main: createFlareTexture(256, 0, 0.4, 1),
      ring: createFlareTexture(128, 0.3, 0.5, 0.6),
      spot: createFlareTexture(64, 0, 0.3, 0.4),
    };
  }, []);

  // Flare configuration
  const flares: FlareElement[] = useMemo(
    () => [
      { texture: flareTextures.main, size: 4, distance: 0, color: new THREE.Color('#fff8e7') },
      { texture: flareTextures.ring, size: 1.5, distance: 0.3, color: new THREE.Color('#ffd480') },
      { texture: flareTextures.spot, size: 0.8, distance: 0.5, color: new THREE.Color('#ff9940') },
      { texture: flareTextures.spot, size: 0.5, distance: 0.7, color: new THREE.Color('#ff6b6b') },
      { texture: flareTextures.ring, size: 1.2, distance: 0.85, color: new THREE.Color('#a78bfa') },
      { texture: flareTextures.spot, size: 0.3, distance: 1.0, color: new THREE.Color('#60a5fa') },
    ],
    [flareTextures],
  );

  const spriteMaterials = useMemo(() => {
    return flares.map(
      (f) =>
        new THREE.SpriteMaterial({
          map: f.texture,
          color: f.color,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 0.8,
        }),
    );
  }, [flares]);

  const lightPos = useMemo(() => new THREE.Vector3(...lightPosition), [lightPosition]);
  const screenPos = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!groupRef.current) return;

    // Project light position to screen space
    screenPos.copy(lightPos).project(camera);

    // Check if light is in front of camera
    const isBehind = screenPos.z > 1;

    // Calculate visibility based on screen position
    const distFromCenter = Math.sqrt(screenPos.x ** 2 + screenPos.y ** 2);
    const visibility = isBehind ? 0 : Math.max(0, 1 - distFromCenter * 0.5);

    // Update sprites along the screen-center to light-position line
    const children = groupRef.current.children as THREE.Sprite[];
    children.forEach((sprite, i) => {
      const flare = flares[i];
      const mat = sprite.material;

      // Position flare elements along the line from center to light
      const t = 1 - flare.distance;
      const x = screenPos.x * t;
      const y = screenPos.y * t;

      // Convert back to world space (approximate)
      const worldPos = new THREE.Vector3(x, y, 0.5).unproject(camera);
      sprite.position.copy(worldPos);

      // Scale based on distance from camera
      const dist = camera.position.distanceTo(sprite.position);
      sprite.scale.setScalar(flare.size * (dist * 0.1));

      // Update opacity
      mat.opacity = visibility * 0.6;
    });
  });

  return (
    <group ref={groupRef}>
      {flares.map((_, i) => (
        <sprite key={i} material={spriteMaterials[i]} />
      ))}
    </group>
  );
}
