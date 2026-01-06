// Fragment shader for GPU-based cellular automata simulation
// Implements customizable cellular automata rules with sphere wrapping support
// Tracks age and neighbor heat for color visualization
export const simulationFragmentShader = /* glsl */ `
  uniform sampler2D uTexture;        // Previous frame's state
  uniform vec2 uResolution;           // Texture resolution (width, height)
  uniform float uBirthRules[9];       // Birth rules: array[neighborCount] = 1.0 if birth, 0.0 otherwise
  uniform float uSurviveRules[9];     // Survive rules: array[neighborCount] = 1.0 if survive, 0.0 otherwise
  uniform bool uColonyMode;           // Whether colony mode is enabled
  
  varying vec2 vUv;
  
  // Sample a neighbor with proper wrapping for sphere topology
  // Longitude (U) wraps around, Latitude (V) clamps at poles
  // Returns vec4: r=state, g=age, b=heat, a=unused
  vec4 sampleNeighborFull(vec2 uv, vec2 offset) {
    vec2 pixelSize = 1.0 / uResolution;
    vec2 neighborUV = uv + offset * pixelSize;
    
    // Wrap U (longitude) - seamless wrapping
    neighborUV.x = fract(neighborUV.x);
    
    // Clamp V (latitude) - no wrapping at poles
    neighborUV.y = clamp(neighborUV.y, 0.0, 1.0);
    
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
      // State encoding: 0.0 = dead, 0.33 = colony A (1), 0.67 = colony B (2)
      if (n1.r > 0.1) { neighbors += 1.0; if (n1.r < 0.5) neighborsColonyA += 1.0; }
      if (n2.r > 0.1) { neighbors += 1.0; if (n2.r < 0.5) neighborsColonyA += 1.0; }
      if (n3.r > 0.1) { neighbors += 1.0; if (n3.r < 0.5) neighborsColonyA += 1.0; }
      if (n4.r > 0.1) { neighbors += 1.0; if (n4.r < 0.5) neighborsColonyA += 1.0; }
      if (n5.r > 0.1) { neighbors += 1.0; if (n5.r < 0.5) neighborsColonyA += 1.0; }
      if (n6.r > 0.1) { neighbors += 1.0; if (n6.r < 0.5) neighborsColonyA += 1.0; }
      if (n7.r > 0.1) { neighbors += 1.0; if (n7.r < 0.5) neighborsColonyA += 1.0; }
      if (n8.r > 0.1) { neighbors += 1.0; if (n8.r < 0.5) neighborsColonyA += 1.0; }
    } else {
      // Classic mode: simple sum of alive neighbors
      neighbors = n1.r + n2.r + n3.r + n4.r + n5.r + n6.r + n7.r + n8.r;
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
          // Stay alive with same colony
          nextState = current;
        } else {
          // Birth: choose colony based on neighbor majority
          // If more than half are Colony A, new cell is Colony A, else Colony B
          if (neighborsColonyA > neighbors * 0.5) {
            nextState = 0.33;  // Colony A
          } else {
            nextState = 0.67;  // Colony B
          }
        }
        nextAge = min(1.0, currentAge + 1.0 / 255.0);  // Increment age (normalized)
        nextHeat = neighbors / 8.0;  // Store neighbor count normalized
      }
    } else {
      // Classic mode logic
      if (current > 0.5) {
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
