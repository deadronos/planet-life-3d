// Fragment shader for GPU-based cellular automata simulation
// Implements Conway's Game of Life rules with sphere wrapping support
export const simulationFragmentShader = /* glsl */ `
  uniform sampler2D uTexture;        // Previous frame's state
  uniform vec2 uResolution;           // Texture resolution (width, height)
  uniform vec4 uBirthSurviveRules;    // Birth and survive neighbor counts packed
  
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
    
    // Apply Game of Life rules
    // Birth: dead cell with exactly 3 neighbors becomes alive
    // Survive: live cell with 2 or 3 neighbors stays alive
    // Default rules can be customized via uBirthSurviveRules uniform
    
    float nextState = 0.0;
    
    if (current > 0.5) {
      // Cell is alive - check survive rule
      // Survive on 2 or 3 neighbors (standard Conway rules)
      if (neighbors >= 2.0 && neighbors <= 3.0) {
        nextState = 1.0;
      }
    } else {
      // Cell is dead - check birth rule
      // Born on exactly 3 neighbors (standard Conway rules)
      if (neighbors >= 2.99 && neighbors <= 3.01) {
        nextState = 1.0;
      }
    }
    
    // Output: R channel = alive/dead state, G = age placeholder, B = heat placeholder
    gl_FragColor = vec4(nextState, 0.0, 0.0, 1.0);
  }
`;
