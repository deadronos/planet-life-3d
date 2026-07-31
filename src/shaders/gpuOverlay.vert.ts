// Vertex shader for GPU life texture overlay
export const gpuOverlayVertexShader = /* glsl */ `
  uniform sampler2D uLifeTexture;
  uniform float uCellLift;
  uniform float uTime;
  uniform float uPulseSpeed;
  uniform float uPulseIntensity;

  varying vec2 vUv;
  
  void main() {
    // Three.js SphereGeometry UVs run opposite to sim longitude: the sim
    // stores lon lo in tex col lo (both CPU/worker lifeTexture.ts and the
    // GPU sim), so we mirror the overlay U sample to keep CPU and GPU paths
    // visually consistent and ensure seeded cells appear where the user
    // clicked. Do NOT also reverse columns when writing life textures.
    vUv = vec2(1.0 - uv.x, uv.y);
    
    vec4 texel = texture2D(uLifeTexture, vUv);
    float state = texel.r;
    
    // Only displace if alive (state > 0.02 matches the fragment discard threshold)
    float displacement = 0.0;
    if (state > 0.02) {
      float pulse = sin(uTime * uPulseSpeed) * 0.5 + 0.5; // 0 to 1
      displacement = uCellLift + (pulse * uPulseIntensity * uCellLift);
    }
    
    vec3 newPosition = position + normal * displacement;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;
