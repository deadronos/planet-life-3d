import { useMemo } from 'react';
import * as THREE from 'three';

interface DistantSunProps {
  position?: [number, number, number];
  size?: number;
}

/**
 * A large distant sun/star that serves as the visible source for the lens flare.
 * Positioned far away but rendered large enough to be clearly visible.
 */
export function DistantSun({ position = [60, 60, 80], size = 12 }: DistantSunProps) {
  // Create a glowing sun material with emissive properties
  const sunMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fff8dc'), // Warm cream/yellow
      transparent: false,
    });
  }, []);

  // Create a glow layer around the sun
  const glowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#ffcc66') },
        uIntensity: { value: 1.5 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec3 vNormal;
        
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          vec3 glow = uColor * intensity * uIntensity;
          gl_FragColor = vec4(glow, intensity * 0.8);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, []);

  return (
    <group position={position}>
      {/* Main sun sphere */}
      <mesh>
        <sphereGeometry args={[size, 48, 48]} />
        <primitive object={sunMaterial} attach="material" />
      </mesh>

      {/* Outer glow layer */}
      <mesh>
        <sphereGeometry args={[size * 1.4, 48, 48]} />
        <primitive object={glowMaterial} attach="material" />
      </mesh>

      {/* Corona glow - even larger and more subtle */}
      <mesh>
        <sphereGeometry args={[size * 2.2, 32, 32]} />
        <meshBasicMaterial
          color="#ffaa44"
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
