// Fragment shader that classifies each texel into birth / death / alive
// buckets so the main thread can read back HUD stats from the GPU sim.
// Renders the previous state texture and the newly computed state texture
// into a stats target; the main thread then sums the channels:
//   R = births (dead -> alive), G = deaths (alive -> dead), B = population.
export const gpuStatsFragmentShader = /* glsl */ `
  uniform sampler2D uPrevState;
  uniform sampler2D uCurrentState;

  varying vec2 vUv;

  void main() {
    float prev = texture2D(uPrevState, vUv).r;
    float cur = texture2D(uCurrentState, vUv).r;

    float birth = (prev < 0.1 && cur > 0.1) ? 1.0 : 0.0;
    float death = (prev > 0.1 && cur < 0.1) ? 1.0 : 0.0;
    float alive = (cur > 0.1) ? 1.0 : 0.0;

    gl_FragColor = vec4(birth, death, alive, 1.0);
  }
`;
