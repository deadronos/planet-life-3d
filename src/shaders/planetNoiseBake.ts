// Static planet-surface noise, baked once into an equirectangular texture
// (see src/components/planetLife/planetNoiseTexture.ts) instead of being
// evaluated per fragment every frame. Channels:
//   r = snoise(p * 8.0)                        (high-frequency bump), encoded *0.5+0.5
//   g = snoise(p * 1.5)                        (low-frequency tint),  encoded *0.5+0.5
//   b = snoise(p * 2.2 + offset) * 0.5 + 0.5   (basin)
//   a = snoise(p * 4.5 + offset) * 0.5 + 0.5   (ridge)
// where p = direction * planetRadius, matching the old world-space lookup.

// Equirect mapping shared by the bake and the planet material. Keep the two in sync.
export const PLANET_NOISE_EQUIRECT_GLSL = `
  #define PLANET_NOISE_PI 3.141592653589793
  vec2 planetNoiseUv(vec3 dir) {
    return vec2(
      atan(dir.z, dir.x) / (2.0 * PLANET_NOISE_PI) + 0.5,
      asin(clamp(dir.y, -1.0, 1.0)) / PLANET_NOISE_PI + 0.5
    );
  }
`;

export const PLANET_NOISE_BAKE_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const PLANET_NOISE_BAKE_FRAG = `
  uniform float uRadius;
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

  #define PI 3.141592653589793

  void main() {
    // Inverse of planetNoiseUv(): texel centre -> direction on the unit sphere.
    float lon = (vUv.x - 0.5) * 2.0 * PI;
    float lat = (vUv.y - 0.5) * PI;
    vec3 dir = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
    vec3 p = dir * uRadius;

    float noiseHigh = snoise(p * 8.0);
    float noiseLow = snoise(p * 1.5);
    float basinNoise = snoise(p * 2.2 + vec3(3.1, 0.4, 1.7)) * 0.5 + 0.5;
    float ridgeNoise = snoise(p * 4.5 + vec3(0.2, 2.8, 1.1)) * 0.5 + 0.5;
    gl_FragColor = vec4(noiseHigh * 0.5 + 0.5, noiseLow * 0.5 + 0.5, basinNoise, ridgeNoise);
  }
`;
