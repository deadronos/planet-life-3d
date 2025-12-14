import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export function usePlanetMaterial(params: {
  atmosphereColor: string;
  rimIntensity: number;
  rimPower: number;
  terminatorSharpness: number;
  terminatorBoost: number;
  planetRoughness: number;
  planetWireframe: boolean;
  latCells: number;
  lonCells: number;
  lightPosition: [number, number, number];
}): THREE.ShaderMaterial {
  const planetMaterial = useMemo(() => {
    // Standard directional light
    const lightDir = new THREE.Vector3(...params.lightPosition).normalize();
    // Base ambient to ensure the night side isn't pitch black
    const ambientFloor = THREE.MathUtils.clamp(params.planetRoughness * 0.65, 0.05, 0.95);

    const uniforms = {
      uDayColor: { value: new THREE.Color('#3a4b66') }, // Brighter day blue
      uNightColor: { value: new THREE.Color('#0c0e15') },
      uTerminatorColor: { value: new THREE.Color('#ff5522') },
      uRimColor: { value: new THREE.Color(params.atmosphereColor) },
      uLightDir: { value: lightDir },
      uRimPower: { value: params.rimPower },
      uRimIntensity: { value: params.rimIntensity },
      uTerminatorSharpness: { value: params.terminatorSharpness },
      uTerminatorBoost: { value: params.terminatorBoost },
      uAmbientFloor: { value: ambientFloor },
      uGridSize: { value: new THREE.Vector2(params.lonCells, params.latCells) },
      uRoughnessBase: { value: params.planetRoughness },
      uSunColor: { value: new THREE.Color('#fff0d0') }, // Warm sun specular
    } satisfies Record<string, { value: THREE.Vector3 | THREE.Color | number | THREE.Vector2 }>;

    const material = new THREE.ShaderMaterial({
      uniforms,
      wireframe: params.planetWireframe,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vWorldPos;
        varying vec2 vUv;

        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vUv = uv;
          
          vNormal = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uDayColor;
        uniform vec3 uNightColor;
        uniform vec3 uTerminatorColor;
        uniform vec3 uRimColor;
        uniform vec3 uSunColor;
        uniform vec3 uLightDir;
        uniform float uRimPower;
        uniform float uRimIntensity;
        uniform float uTerminatorSharpness;
        uniform float uTerminatorBoost;
        uniform float uAmbientFloor;
        uniform vec2 uGridSize;
        uniform float uRoughnessBase;

        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vWorldPos;
        varying vec2 vUv;

        // --- Simplex Noise 3D (Ashima/WebGl-Noise) ---
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
          const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i  = floor(v + dot(v, C.yyy) );
          vec3 x0 = v - i + dot(i, C.xxx) ;
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min( g.xyz, l.zxy );
          vec3 i2 = max( g.xyz, l.zxy );
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute( permute( permute(
                     i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                   + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                   + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
          float n_ = 0.142857142857;
          vec3  ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_ );
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4( x.xy, y.xy );
          vec4 b1 = vec4( x.zw, y.zw );
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
          vec3 p0 = vec3(a0.xy,h.x);
          vec3 p1 = vec3(a0.zw,h.y);
          vec3 p2 = vec3(a1.xy,h.z);
          vec3 p3 = vec3(a1.zw,h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                        dot(p2,x2), dot(p3,x3) ) );
        }

        void main() {
          vec3 n = normalize(vNormal);
          vec3 l = normalize(uLightDir);
          vec3 v = normalize(vViewDir);

          // 1. Noise
          float noiseHigh = snoise(vWorldPos * 8.0);
          float noiseLow = snoise(vWorldPos * 1.5);
          vec3 bumpParams = vec3(noiseHigh * 0.05); 
          n = normalize(n + bumpParams * 0.2);

          // 2. Grid Anchor
          vec2 gridUV = vUv * uGridSize;
          vec2 gridPos = fract(gridUV);
          vec2 distToEdge = min(gridPos, 1.0 - gridPos);
          float minDist = min(distToEdge.x, distToEdge.y);
          float gridEdge = smoothstep(0.02, 0.08, minDist);
          float seamAO = mix(0.7, 1.0, gridEdge);

          // 3. Lighting
          float ndl = max(0.0, dot(n, l));
          
          // Specular (Phong)
          vec3 r = reflect(-l, n);
          float specFactor = pow(max(0.0, dot(r, v)), 20.0); // Shininess for ocean
          // Mask specular by grid edge (cells are matte?) or just let it be
          // Let's add specular
          vec3 specular = uSunColor * specFactor * 0.4; // 40% intensity

          // Terminator
          float lightFactor = smoothstep(-0.2, 0.2, dot(n, l)); // Use unmasked dot for terminator
          float terminatorBand = 1.0 - abs(dot(n, l));
          terminatorBand = pow(terminatorBand, 8.0);
          
          float shade = max(lightFactor, uAmbientFloor * 0.1); 
          
          vec3 dayColor = uDayColor + vec3(noiseLow * 0.02);
          vec3 nightColor = uNightColor - vec3(noiseLow * 0.01);
          
          vec3 surfaceColor = mix(nightColor, dayColor, shade);
          vec3 sunset = uTerminatorColor * terminatorBand * 0.4;
          
          /* Combine */
          surfaceColor += sunset;
          surfaceColor *= seamAO;
          
          // Add specular only on lit side
          surfaceColor += specular * shade; 

          // Rim
          float rimMatch = 1.0 - max(0.0, dot(n, v));
          float rim = pow(rimMatch, uRimPower);
          float atmosphere = pow(rimMatch, uRimPower * 0.6) * 0.5;
          vec3 finalRim = uRimColor * (rim * uRimIntensity + atmosphere * uRimIntensity * 0.5);
          
          vec3 finalColor = surfaceColor + finalRim;
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });

    material.toneMapped = true;
    material.depthWrite = true;
    return material;
  }, [
    params.atmosphereColor,
    params.rimIntensity,
    params.rimPower,
    params.terminatorSharpness,
    params.terminatorBoost,
    params.planetRoughness,
    params.planetWireframe,
    params.latCells,
    params.lonCells,
    params.lightPosition,
  ]);

  // Dispose logic remains the same (handled by react usually but explicit dispose is good)
  useEffect(() => {
    return () => planetMaterial.dispose();
  }, [planetMaterial]);

  return planetMaterial;
}
