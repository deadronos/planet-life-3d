// Vertex shader for GPU life texture overlay
export const gpuOverlayVertexShader = /* glsl */ `
  uniform sampler2D uLifeTexture;
  uniform float uCellLift;
  uniform float uTime;
  uniform float uPulseSpeed;
  uniform float uPulseIntensity;

  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    
    vec4 texel = texture2D(uLifeTexture, uv);
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
