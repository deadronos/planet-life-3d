// Vertex shader for GPU life texture overlay
export const gpuOverlayVertexShader = /* glsl */ `
  uniform sampler2D uLifeTexture;
  uniform float uCellLift;
  uniform float uTime;
  uniform float uPulseSpeed;
  uniform float uPulseIntensity;

  varying vec2 vUv;
  
  void main() {
    // Three.js SphereGeometry UVs run opposite to sim longitude (see the
    // matching flip in lifeTexture.ts, where sim lon lo is written to tex
    // col w-1-lo). The GPU sim stores sim lon directly in tex col lo, so we
    // mirror the overlay U sample to keep GPU and CPU paths visually
    // consistent and ensure seeded cells appear where the user clicked.
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
