# Design: Vertex Displacement & Unified Rendering

**ID**: DESIGN007
**Date**: 2026-01-06
**Status**: Implemented

## Context

The user requested a visual enhancement: "Alive" cells on the planet surface should not only be colored but also physically displaced (extruded) outwards, with a pulsing animation to make the planet feel "alive".

Previously, the application used two different rendering paths for the cell overlay:

1.  **CPU/Worker Simulation**: Used a `meshBasicMaterial` with a `DataTexture` containing pre-resolved RGBA colors.
2.  **GPU Simulation**: Used a custom `ShaderMaterial` (`gpuOverlayMaterial`) reading from a GPU-generated float texture.

This bifurcation meant that implementing vertex displacement (which requires a custom Vertex Shader) would only work for the GPU simulation unless we duplicated the logic or unified the pipeline.

## Problem Statement

- **Visual Inconsistency**: Implementing features in shaders only benefits the GPU simulation mode.
- **No Vertex Displacement for CPU Modes**: `meshBasicMaterial` does not support custom vertex displacement logic.
- **Performance/Redundancy**: Calculating colors on the CPU (`resolveCellColor`) for the texture overlay is redundant if a shader can do it (and the GPU shader already had to do it).

## Solution

**Unified Rendering Pipeline**:
Switch all simulation modes (Classic CPU, Worker Sim, GPU Sim) to use the **same** render material (`gpuOverlayMaterial`) for the cell overlay.

### 1. DataTexture Format Change

Instead of writing final colors (e.g., `#FF4444`) to the texture, the CPU simulations now write **raw simulation properties** to the texture channels, matching the format the GPU simulation naturally produces:

- **R Channel**: State (0 = Dead, 255 = Alive). For Colony mode, specific values map to Colony A/B.
- **G Channel**: Age (0-255).
- **B Channel**: Neighbor Heat (0-255).
- **A Channel**: 255 (Opaque).

### 2. Shader Logic

**Vertex Shader (`gpuOverlay.vert.ts`)**:

- Reads the "Alive" state from the texture.
- If alive ($rate > 0.02$), applies a displacement along the normal.
- Adds a sine-wave pulse based on time (`uTime`), `uPulseSpeed`, and `uPulseIntensity`.

**Fragment Shader (`gpuOverlay.frag.ts`)**:

- Reads State, Age, Heat from texture.
- Calculates the final pixel color based on uniform settings (`uColorMode`, `uCellColor`, etc.).
- This moves color resolution from CPU to GPU for all modes.

### 3. Component Updates

- `PlanetLife.tsx`: Always renders the `gpuOverlayMaterial`. It passes either the `gpuTexture` (from GPUSim) or `lifeTex.tex` (from usePlanetLifeSim) to the `uLifeTexture` uniform.
- `usePlanetLifeSim`: Updates the DataTexture with raw values.
- `writeLifeTexture`: Refactored to write raw values instead of calling `resolveCellColor`.

## Benefits

- **Consistent Visuals**: Vertex displacement and pulsing work in all modes.
- **Code Simplification**: One rendering path for the overlay.
- **Performance**: Color resolution happens in parallel on the GPU for CPU sims too.
- **Feature Parity**: Any future shader effects (glow, dissolve, patterns) apply to all modes automatically.

## Limitations

- **Dots Mode**: The "Dots" render mode (instanced meshes) still runs on the CPU and requires `resolveCellColor`. This logic was preserved specifically for the Dots mode but is no longer used for the Texture overlay.
