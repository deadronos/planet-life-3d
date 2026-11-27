import { SNOISE_3D_GLSL } from './planetNoiseBake';

// Fragment shader for GPU-based cellular automata simulation
// Implements customizable cellular automata rules with sphere wrapping support
// Tracks age and neighbor heat for color visualization
export const simulationFragmentShader = /* glsl */ `
  uniform sampler2D uTexture;        // Previous frame's state
  uniform vec2 uResolution;           // Texture resolution (width, height)
  uniform float uBirthRules[9];       // Birth rules: array[neighborCount] = 1.0 if birth, 0.0 otherwise
  uniform float uSurviveRules[9];     // Survive rules: array[neighborCount] = 1.0 if survive, 0.0 otherwise
  uniform int uDecayStates;           // Generations state count (2 = classic binary Life, 3..16 = refractory decay)
  uniform bool uColonyMode;           // Whether colony mode is enabled
  uniform bool uPolarWrap;            // Whether latitude wraps across poles to antipodal longitude
  // Ecology profile params (mirror of ECOLOGY_PROFILES in sim/ecology.ts).
  // The GPU path must replicate the CPU's adjustNeighborsForEcology or the
  // two sims silently run different rules.
  uniform bool uEcologyEnabled;
  uniform float uEcologyFertilityBias;
  uniform float uEcologyDroughtBias;
  uniform float uEcologyMountainBias;
  uniform float uEcologySunlightBias;
  
  varying vec2 vUv;

  ${SNOISE_3D_GLSL}

  // Per-cell neighbor-count bias, ported 1:1 from computeEcologySample() in
  // sim/ecology.ts and matching the baked terrain biomes in planetNoiseBake.ts.
  // Uses integer pixel coordinates so each texel matches CPU lat/lon indexing.
  float ecologyBias(vec2 uv) {
    vec2 pixelPos = floor(uv * uResolution);
    float lat01 = pixelPos.y / max(1.0, uResolution.y - 1.0);
    float lon01 = pixelPos.x / uResolution.x;
    float latRad = (lat01 - 0.5) * 3.141592653589793;
    float lonRad = (lon01 - 0.5) * 6.283185307179586;
    float cosLat = cos(latRad);
    vec3 dir = vec3(cosLat * cos(lonRad), sin(latRad), cosLat * sin(lonRad));
    vec3 pBiome = dir * 2.5;

    float basin = snoise(pBiome * 2.2 + vec3(3.1, 0.4, 1.7)) * 0.5 + 0.5;
    float ridge = snoise(pBiome * 4.5 + vec3(0.2, 2.8, 1.1)) * 0.5 + 0.5;

    float equator = 1.0 - abs(dir.y);
    float altitude = clamp(ridge, 0.0, 1.0);
    float temperature = clamp(equator * 0.78 + basin * 0.22, 0.0, 1.0);
    float moisture = clamp(
      basin * 0.62 +
        equator * 0.24 -
        max(0.0, ridge - 0.62) * 0.35 +
        uEcologyFertilityBias -
        uEcologyDroughtBias,
      0.0,
      1.0);
    float sunlight = clamp(
      0.5 + cos((lon01 - 0.18) * 6.283185307179586) * 0.3 + equator * 0.12, 0.0, 1.0);
    float fertility = clamp(
      moisture * 0.42 +
        (1.0 - abs(temperature - 0.58) * 1.6) * 0.32 +
        (1.0 - altitude) * 0.18 +
        uEcologyFertilityBias,
      0.0,
      1.0);
    float viability = clamp(
      fertility +
        sunlight * uEcologySunlightBias -
        max(0.0, 0.28 - moisture) * (0.9 + uEcologyDroughtBias) -
        max(0.0, altitude - 0.7) * (0.72 + uEcologyMountainBias),
      0.0,
      1.0);

    if (viability >= 0.68) return 1.0;
    if (viability <= 0.28) return -1.0;
    return 0.0;
  }
  
  // Sample a neighbor with proper wrapping for sphere topology
  // Longitude (U) wraps around; Latitude (V) either wraps across the poles to
  // antipodal longitude (uPolarWrap = true) or treats out-of-range as empty.
  // Returns vec4: r=state, g=age, b=heat, a=unused
  vec4 sampleNeighborFull(vec2 uv, vec2 offset) {
    vec2 pixelSize = 1.0 / uResolution;
    vec2 neighborUV = uv + offset * pixelSize;
    
    // Wrap U (longitude) - seamless wrapping
    neighborUV.x = fract(neighborUV.x);
    
    if (neighborUV.y < 0.0) {
      if (!uPolarWrap) {
        return vec4(0.0);
      }
      neighborUV.y = 0.5 * pixelSize.y;
      neighborUV.x = fract(neighborUV.x + floor(uResolution.x * 0.5) * pixelSize.x);
    } else if (neighborUV.y > 1.0) {
      if (!uPolarWrap) {
        return vec4(0.0);
      }
      neighborUV.y = 1.0 - 0.5 * pixelSize.y;
      neighborUV.x = fract(neighborUV.x + floor(uResolution.x * 0.5) * pixelSize.x);
    }

    return texture2D(uTexture, neighborUV);
  }
  
  void main() {
    // Get current cell state (r=alive/dead or colony state, g=age, b=neighborHeat)
    vec4 currentCell = texture2D(uTexture, vUv);
    float current = currentCell.r;
    float currentAge = currentCell.g;
    
    // Count alive neighbors (8-neighborhood)
    float neighbors = 0.0;
    float neighborsColonyA = 0.0;
    
    // Sample all 8 neighbors
    vec4 n1 = sampleNeighborFull(vUv, vec2(-1.0, -1.0));
    vec4 n2 = sampleNeighborFull(vUv, vec2( 0.0, -1.0));
    vec4 n3 = sampleNeighborFull(vUv, vec2( 1.0, -1.0));
    vec4 n4 = sampleNeighborFull(vUv, vec2(-1.0,  0.0));
    vec4 n5 = sampleNeighborFull(vUv, vec2( 1.0,  0.0));
    vec4 n6 = sampleNeighborFull(vUv, vec2(-1.0,  1.0));
    vec4 n7 = sampleNeighborFull(vUv, vec2( 0.0,  1.0));
    vec4 n8 = sampleNeighborFull(vUv, vec2( 1.0,  1.0));
    
    if (uColonyMode) {
      // Colony mode: count total neighbors and Colony A neighbors
      // State encoding: 0.0 = dead, 0.33 = colony A (1), 0.67 = colony B (2),
      // 1.0 = legacy Classic alive (normalized to Colony A to match CPU).
      if (n1.r > 0.1) { neighbors += 1.0; if (n1.r < 0.5 || n1.r > 0.85) neighborsColonyA += 1.0; }
      if (n2.r > 0.1) { neighbors += 1.0; if (n2.r < 0.5 || n2.r > 0.85) neighborsColonyA += 1.0; }
      if (n3.r > 0.1) { neighbors += 1.0; if (n3.r < 0.5 || n3.r > 0.85) neighborsColonyA += 1.0; }
      if (n4.r > 0.1) { neighbors += 1.0; if (n4.r < 0.5 || n4.r > 0.85) neighborsColonyA += 1.0; }
      if (n5.r > 0.1) { neighbors += 1.0; if (n5.r < 0.5 || n5.r > 0.85) neighborsColonyA += 1.0; }
      if (n6.r > 0.1) { neighbors += 1.0; if (n6.r < 0.5 || n6.r > 0.85) neighborsColonyA += 1.0; }
      if (n7.r > 0.1) { neighbors += 1.0; if (n7.r < 0.5 || n7.r > 0.85) neighborsColonyA += 1.0; }
      if (n8.r > 0.1) { neighbors += 1.0; if (n8.r < 0.5 || n8.r > 0.85) neighborsColonyA += 1.0; }
    } else if (uDecayStates > 2) {
      // Generations mode: only firing cells (state 1 -> > 0.92) count as live neighbors;
      // refractory cells (0.1..0.92) are ignored.
      neighbors =
        (n1.r > 0.92 ? 1.0 : 0.0) +
        (n2.r > 0.92 ? 1.0 : 0.0) +
        (n3.r > 0.92 ? 1.0 : 0.0) +
        (n4.r > 0.92 ? 1.0 : 0.0) +
        (n5.r > 0.92 ? 1.0 : 0.0) +
        (n6.r > 0.92 ? 1.0 : 0.0) +
        (n7.r > 0.92 ? 1.0 : 0.0) +
        (n8.r > 0.92 ? 1.0 : 0.0);
    } else {
      // Classic mode: count any live neighbor (including 0.33/0.67 from Colony mode) as 1.0
      neighbors =
        (n1.r > 0.1 ? 1.0 : 0.0) +
        (n2.r > 0.1 ? 1.0 : 0.0) +
        (n3.r > 0.1 ? 1.0 : 0.0) +
        (n4.r > 0.1 ? 1.0 : 0.0) +
        (n5.r > 0.1 ? 1.0 : 0.0) +
        (n6.r > 0.1 ? 1.0 : 0.0) +
        (n7.r > 0.1 ? 1.0 : 0.0) +
        (n8.r > 0.1 ? 1.0 : 0.0);
    }

    // Apply the ecology neighbor-count bias, matching the CPU/worker path
    // (adjustNeighborsForEcology). Colony A count stays raw on purpose:
    // the CPU only adjusts the total neighbor count used for rule lookups.
    if (uEcologyEnabled) {
      neighbors = clamp(neighbors + ecologyBias(vUv), 0.0, 8.0);
    }
    
    // Apply customizable rules based on neighbor count
    int neighborCount = int(neighbors + 0.5);  // Round to nearest int
    float nextState = 0.0;
    float nextAge = 0.0;
    float nextHeat = 0.0;
    
    if (uColonyMode) {
      // Colony mode logic
      bool isAlive = current > 0.1;
      bool shouldLive = false;
      
      if (isAlive) {
        // Check survive rule
        if (neighborCount >= 0 && neighborCount <= 8) {
          shouldLive = uSurviveRules[neighborCount] > 0.5;
        }
      } else {
        // Check birth rule
        if (neighborCount >= 0 && neighborCount <= 8) {
          shouldLive = uBirthRules[neighborCount] > 0.5;
        }
      }
      
      if (shouldLive) {
        if (isAlive) {
          // Stay alive with same colony (normalize Classic 1.0 -> Colony A 0.33)
          nextState = (current < 0.5 || current > 0.85) ? 0.33 : 0.67;
        } else {
          // Birth typing matches the CPU/worker sim (LifeGridSimColony): a
          // new cell becomes Colony A when at least 2 of its neighbors are
          // Colony A, otherwise Colony B.
          if (neighborsColonyA >= 2.0) {
            nextState = 0.33;  // Colony A
          } else {
            nextState = 0.67;  // Colony B
          }
        }
        nextAge = min(1.0, currentAge + 1.0 / 255.0);  // Increment age (normalized)
        nextHeat = neighbors / 8.0;  // Store neighbor count normalized
      }
    } else if (uDecayStates > 2) {
      // Generations mode:
      // - Firing cells (> 0.92) survive to 1.0 or enter refractory state 2
      // - Refractory cells (0.1..0.92) advance s -> s + 1 until s >= uDecayStates (dead 0.0)
      // - Dead cells (< 0.1) are born into firing state 1.0 when matching birth rules
      float denom = float(uDecayStates - 1);
      if (current > 0.92) {
        bool survives = false;
        if (neighborCount >= 0 && neighborCount <= 8) {
          survives = uSurviveRules[neighborCount] > 0.5;
        }
        if (survives) {
          nextState = 1.0;
        } else {
          nextState = 0.15 + 0.75 * (float(uDecayStates - 2) / denom);
        }
        nextAge = min(1.0, currentAge + 1.0 / 255.0);
        nextHeat = neighbors / 8.0;
      } else if (current >= 0.1) {
        float cool = clamp((current - 0.15) / 0.75, 0.0, 1.0);
        int s = uDecayStates - int(floor(cool * denom + 0.5));
        if (s < 2) s = 2;
        if (s >= uDecayStates) s = uDecayStates - 1;
        int nextS = s + 1;
        if (nextS >= uDecayStates) {
          nextState = 0.0;
        } else {
          nextState = 0.15 + 0.75 * (float(uDecayStates - nextS) / denom);
          nextAge = min(1.0, currentAge + 1.0 / 255.0);
          nextHeat = neighbors / 8.0;
        }
      } else {
        if (neighborCount >= 0 && neighborCount <= 8 && uBirthRules[neighborCount] > 0.5) {
          nextState = 1.0;
          nextAge = min(1.0, currentAge + 1.0 / 255.0);
          nextHeat = neighbors / 8.0;
        }
      }
    } else {
      // Classic mode logic: treat any live state (> 0.1, including Colony 0.33/0.67) as alive
      if (current > 0.1) {
        // Cell is alive - check survive rule
        if (neighborCount >= 0 && neighborCount <= 8) {
          nextState = uSurviveRules[neighborCount];
        }
      } else {
        // Cell is dead - check birth rule
        if (neighborCount >= 0 && neighborCount <= 8) {
          nextState = uBirthRules[neighborCount];
        }
      }
      
      if (nextState > 0.5) {
        // Cell is alive next generation
        nextAge = min(1.0, currentAge + 1.0 / 255.0);  // Increment age (normalized 0-1)
        nextHeat = neighbors / 8.0;  // Store neighbor count normalized to 0-1
      }
    }
    
    // Output: R = alive/dead state, G = age (0-1), B = neighbor heat (0-1)
    gl_FragColor = vec4(nextState, nextAge, nextHeat, 1.0);
  }
`;
