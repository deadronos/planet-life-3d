# GPU Cellular Automata Implementation

This document explains the GPU-based cellular automata implementation for planet-life-3d.

## Overview

The GPU implementation uses WebGL fragment shaders to compute cellular automata rules in parallel for every cell on the grid. This approach enables much higher resolutions (512x1024+ cells) without performance degradation compared to CPU-based simulation.

## Architecture

### Ping-Pong Buffer Pattern

The GPU simulation uses a double-buffering technique called "ping-pong" rendering:

1. **Two Render Targets**: We maintain two WebGL render targets (Frame Buffer Objects):
   - Buffer A: Current state
   - Buffer B: Next state

2. **Render Loop**:

   ```
   Frame N:   Read from A → Compute in shader → Write to B
   Frame N+1: Read from B → Compute in shader → Write to A
   ```

3. **Why It's Needed**: GPU shaders cannot read and write to the same texture simultaneously. By alternating between two buffers, we ensure the previous state is always available for reading while we write the new state.

## Shader Implementation

### Vertex Shader (`simulation.vert.ts`)

A simple fullscreen quad vertex shader that passes UV coordinates to the fragment shader:

```glsl
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

### Fragment Shader (`simulation.frag.ts`)

The fragment shader runs once per pixel (cell) and:

1. **Reads Current State**: Samples the current cell's alive/dead state from the texture
2. **Counts Neighbors**: Samples the 8 surrounding cells (Moore neighborhood)
3. **Applies Rules**: Implements Conway's Game of Life rules:
   - Birth: Dead cell with exactly 3 neighbors becomes alive
   - Survival: Live cell with 2 or 3 neighbors stays alive
   - Death: Otherwise, cell becomes/stays dead
4. **Writes New State**: Outputs the new state to `gl_FragColor`

#### Sphere Wrapping

The shader handles spherical topology correctly:

- **Longitude (U-axis)**: Uses `fract()` to wrap seamlessly around the sphere

  ```glsl
  neighborUV.x = fract(neighborUV.x);  // 0.0 wraps to 1.0 and vice versa
  ```

- **Latitude (V-axis)**: Uses `clamp()` to prevent wrapping at the poles
  ```glsl
  neighborUV.y = clamp(neighborUV.y, 0.0, 1.0);  // Stops at poles
  ```

This ensures:

- The equator wraps around naturally (longitude wraps)
- The poles don't wrap (latitude clamps)
- Neighbors near poles are correctly sampled

## Component Structure

### GPUSimulation Component

Located in `src/components/GPUSimulation.tsx`:

```typescript
export function GPUSimulation({
  resolution = 512,
  running = true,
  onTextureUpdate,
}: {
  resolution?: number;
  running?: boolean;
  onTextureUpdate?: (texture: THREE.Texture) => void;
});
```

**Responsibilities:**

- Creates and manages two render targets (ping-pong buffers)
- Initializes simulation with random or empty state
- Runs the simulation loop using `useFrame()` from R3F
- Swaps buffers after each frame
- Notifies parent component of texture updates

**Key Implementation Details:**

1. **Initialization** (in `useEffect`):
   - Creates random initial state as Float32Array
   - Renders initial state to both buffers
   - Each pixel stores: R=alive/dead, G=age, B=heat, A=1.0

2. **Simulation Loop** (in `useFrame`):
   - Determines read/write buffers based on current state
   - Sets shader uniform to read from current buffer
   - Renders fullscreen quad to write buffer
   - Swaps buffer roles for next frame
   - Calls `onTextureUpdate` with new texture

3. **Cleanup**:
   - Disposes render targets
   - Disposes shader material
   - Disposes geometry

### Integration with PlanetLife

The `PlanetLife` component conditionally renders either:

1. **CPU Mode** (default):
   - Uses `usePlanetLifeSim` hook
   - Writes to DataTexture each frame
   - Updates instanced mesh for dots

2. **GPU Mode** (when `gpuSim` is enabled):
   - Renders `<GPUSimulation>` component
   - Receives texture updates via callback
   - Maps GPU texture to planet sphere
   - Disables dots mode (requires GPU→CPU readback)

## Performance Characteristics

### GPU Mode Benefits

- **Parallel Computation**: Every cell computed simultaneously on GPU
- **High Resolution**: 512x1024+ grids run at 60 FPS
- **No JavaScript Overhead**: Rules computed entirely in GLSL
- **Memory Efficiency**: State stored in GPU texture memory

### GPU Mode Limitations

- **Dots Mode Disabled**: Reading GPU texture to CPU for instancing is expensive
- **Initial Setup Cost**: Creating render targets and shaders takes time
- **WebGL Support**: Requires WebGL 2.0 with float texture support
- **Fixed Rules**: Changing rules requires shader recompilation

## Usage

### Enabling GPU Mode

1. Open Leva UI controls
2. Navigate to "Debug" folder
3. Enable "gpuSim" toggle
4. Optionally increase resolution (latCells/lonCells)

### Recommended Settings for GPU Mode

- **Resolution**: 512x512 or 512x1024
- **Render Mode**: "Texture" (dots disabled in GPU mode)
- **Tick Speed**: Fast (GPU can handle higher speeds)

## Future Enhancements

### Possible Improvements

1. **Interactive Seeding**: Implement texture writing for meteor impacts
   - Create a separate render pass to write patterns to GPU texture
   - Use blend modes or custom shader for pattern insertion

2. **Age and Heat Tracking**: Extend shader to track cell age and neighbor heat
   - Use additional texture channels (G=age, B=heat)
   - Implement decay and accumulation in shader

3. **Custom Rules**: Add UI controls to modify birth/survival rules
   - Pass rule parameters as shader uniforms
   - Rebuild shader material when rules change

4. **Multi-State Rules**: Support more complex cellular automata
   - Use multiple textures for different cell types
   - Implement multi-channel logic in shader

5. **Cube Map Mode**: Use cube map instead of equirectangular
   - Reduces pole distortion significantly
   - More complex neighbor calculation across faces

## Technical Notes

### Float Texture Precision

- Uses `THREE.FloatType` for render targets
- Provides higher precision than `THREE.UnsignedByteType`
- Required for future extensions (age tracking, heat accumulation)

### Nearest Filtering

- Uses `THREE.NearestFilter` for both min and mag filters
- Prevents interpolation between cells
- Ensures crisp, pixel-perfect cell boundaries

### React Hooks Compatibility

The implementation carefully follows React hooks rules:

- Shader material mutations only occur in effects or `useFrame`
- Uses `useMemo` for immutable initial creation
- Includes ESLint directives for intentional mutations in render loops

## References

- [WebGL Ping-Pong Technique](https://threejs.org/examples/#webgl_gpgpu_birds)
- [React Three Fiber useFrame](https://docs.pmnd.rs/react-three-fiber/api/hooks#useframe)
- [Conway's Game of Life Rules](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life)
- [GPU Computation with Three.js](https://discourse.threejs.org/t/gpgpu-in-three-js/29515)
