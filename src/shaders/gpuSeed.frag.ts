// Fragment shader for seeding patterns on GPU texture
// Writes pattern data to specific UV coordinates
export const gpuSeedFragmentShader = /* glsl */ `
  uniform sampler2D uCurrentState;  // Current simulation state
  uniform sampler2D uPatternData;    // Pattern to seed (1x1 or larger texture)
  uniform vec2 uResolution;          // Simulation texture resolution
  uniform vec2 uSeedCenter;          // Center UV coordinates for seeding
  uniform vec2 uPatternSize;         // Pattern size in pixels
  uniform float uSeedMode;           // 0=set, 1=toggle, 2=clear, 3=random
  uniform float uSeedProbability;    // For random mode
  uniform bool uColonyMode;          // Whether colony mode is enabled
  uniform float uRandomSeed;         // Random seed for variation
  
  varying vec2 vUv;
  
  // Simple pseudo-random function
  float rand(vec2 co) {
    return fract(sin(dot(co + uRandomSeed, vec2(12.9898, 78.233))) * 43758.5453);
  }
  
  void main() {
    vec4 currentCell = texture2D(uCurrentState, vUv);
    
    // Calculate distance from seed center
    vec2 pixelPos = vUv * uResolution;
    vec2 seedPixelPos = uSeedCenter * uResolution;
    vec2 offset = pixelPos - seedPixelPos;
    
    // Check if we're within the pattern bounds
    vec2 halfPattern = uPatternSize * 0.5;
    bool inPattern = abs(offset.x) <= halfPattern.x && abs(offset.y) <= halfPattern.y;
    
    if (inPattern) {
      // Calculate pattern UV (0-1) based on offset
      vec2 patternUV = (offset + halfPattern) / uPatternSize;
      patternUV.y = 1.0 - patternUV.y;  // Flip Y for correct orientation
      
      // Sample pattern (pattern texture has 1.0 for alive cells, 0.0 for dead)
      float patternValue = texture2D(uPatternData, patternUV).r;
      
      if (patternValue > 0.5) {
        // Pattern says this cell should be affected
        vec4 newCell = currentCell;
        
        if (uSeedMode < 0.5) {
          // Set mode - make alive
          if (uColonyMode) {
            // Random colony choice
            newCell.r = rand(vUv) < 0.5 ? 0.33 : 0.67;
          } else {
            newCell.r = 1.0;
          }
          newCell.g = 0.0;  // Reset age
          newCell.b = 0.0;  // Reset heat
        } else if (uSeedMode < 1.5) {
          // Toggle mode
          if (currentCell.r > 0.1) {
            newCell.r = 0.0;
            newCell.g = 0.0;
            newCell.b = 0.0;
          } else {
            if (uColonyMode) {
              newCell.r = rand(vUv) < 0.5 ? 0.33 : 0.67;
            } else {
              newCell.r = 1.0;
            }
            newCell.g = 0.0;
            newCell.b = 0.0;
          }
        } else if (uSeedMode < 2.5) {
          // Clear mode
          newCell.r = 0.0;
          newCell.g = 0.0;
          newCell.b = 0.0;
        } else {
          // Random mode
          if (rand(vUv * 1.234) < uSeedProbability) {
            if (uColonyMode) {
              newCell.r = rand(vUv * 5.678) < 0.5 ? 0.33 : 0.67;
            } else {
              newCell.r = 1.0;
            }
            newCell.g = 0.0;
            newCell.b = 0.0;
          } else {
            newCell.r = 0.0;
            newCell.g = 0.0;
            newCell.b = 0.0;
          }
        }
        
        gl_FragColor = newCell;
      } else {
        // Outside pattern area, keep current state
        gl_FragColor = currentCell;
      }
    } else {
      // Outside seeding area, keep current state
      gl_FragColor = currentCell;
    }
  }
`;
