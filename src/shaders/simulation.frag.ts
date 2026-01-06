// Fragment shader for GPU-based cellular automata simulation
// Implements customizable cellular automata rules with sphere wrapping support
export const simulationFragmentShader = /* glsl */ `
  uniform sampler2D uTexture;        // Previous frame's state
  uniform vec2 uResolution;           // Texture resolution (width, height)
  uniform float uBirthRules[9];       // Birth rules: array[neighborCount] = 1.0 if birth, 0.0 otherwise
  uniform float uSurviveRules[9];     // Survive rules: array[neighborCount] = 1.0 if survive, 0.0 otherwise
  
  varying vec2 vUv;
  
  // Sample a neighbor with proper wrapping for sphere topology
  // Longitude (U) wraps around, Latitude (V) clamps at poles
  float sampleNeighbor(vec2 uv, vec2 offset) {
    vec2 pixelSize = 1.0 / uResolution;
    vec2 neighborUV = uv + offset * pixelSize;
    
    // Wrap U (longitude) - seamless wrapping
    neighborUV.x = fract(neighborUV.x);
    
    // Clamp V (latitude) - no wrapping at poles
    neighborUV.y = clamp(neighborUV.y, 0.0, 1.0);
    
    return texture2D(uTexture, neighborUV).r;
  }
  
  void main() {
    // Get current cell state
    float current = texture2D(uTexture, vUv).r;
    
    // Count alive neighbors (8-neighborhood)
    float neighbors = 0.0;
    neighbors += sampleNeighbor(vUv, vec2(-1.0, -1.0));
    neighbors += sampleNeighbor(vUv, vec2( 0.0, -1.0));
    neighbors += sampleNeighbor(vUv, vec2( 1.0, -1.0));
    neighbors += sampleNeighbor(vUv, vec2(-1.0,  0.0));
    neighbors += sampleNeighbor(vUv, vec2( 1.0,  0.0));
    neighbors += sampleNeighbor(vUv, vec2(-1.0,  1.0));
    neighbors += sampleNeighbor(vUv, vec2( 0.0,  1.0));
    neighbors += sampleNeighbor(vUv, vec2( 1.0,  1.0));
    
    // Apply customizable rules based on neighbor count
    int neighborCount = int(neighbors);
    float nextState = 0.0;
    
    if (current > 0.5) {
      // Cell is alive - check survive rule for this neighbor count
      if (neighborCount >= 0 && neighborCount <= 8) {
        nextState = uSurviveRules[neighborCount];
      }
    } else {
      // Cell is dead - check birth rule for this neighbor count
      if (neighborCount >= 0 && neighborCount <= 8) {
        nextState = uBirthRules[neighborCount];
      }
    }
    
    // Output: R channel = alive/dead state, G = age placeholder, B = heat placeholder
    gl_FragColor = vec4(nextState, 0.0, 0.0, 1.0);
  }
`;
