// Fullscreen quad vertex shader for GPU simulation
// This shader simply passes through UV coordinates to the fragment shader
export const simulationVertexShader = /* glsl */ `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
