# Task: Vertex Displacement & Unified Rendering

**ID**: TASK016
**Status**: Completed
**Date**: 2026-01-06

## Goal

Implement a visual "pulsing" effect for alive cells on the planet surface by physically extruding the vertices of the mesh. Ensure this effect works consistently across all simulation modes (CPU, Worker, GPU).

## Subtasks

- [x] **Research & Design**
  - [x] Analyze existing rendering pipeline differences (CPU vs GPU).
  - [x] Determine that a unified ShaderMaterial approach is required for consistent vertex displacement.
  - [x] Design data format for texture (Raw values: State/Age/Heat).

- [x] **Implementation: Shaders**
  - [x] Update `gpuOverlay.vert.ts` to accept `uLifeTexture`.
  - [x] Implement displacement logic: $Position + Normal * (CellLift + PulseWave)$.
  - [x] Update `gpuOverlay.frag.ts` to handle coloring (moved from CPU).

- [x] **Implementation: Code Refactoring**
  - [x] Refactor `writeLifeTexture` in `lifeTexture.ts` to output raw RGBA bytes.
  - [x] Update `usePlanetLifeSim.ts` to skip `resolveCellColor` for texture updates.
  - [x] Update `PlanetLife.tsx` to conditionally render `gpuOverlayMaterial` for all modes with correct uniforms.

- [x] **Implementation: UI**
  - [x] Add "Pulse Speed" and "Pulse Intensity" to `controls.ts`.
  - [x] Wire controls to shader uniforms in `PlanetLife.tsx`.

- [x] **Verification**
  - [x] Visual check: Classic Mode (pulsing working).
  - [x] Visual check: GPU Mode (pulsing working).
  - [x] Visual check: Dots Mode (colors still working).
  - [x] Build check: `npm run build` passed.

## Outcome

The rendering pipeline is now unified. The "Texture" render mode always uses the GPU shader, providing better performance and consistent visual effects (vertex displacement) regardless of the underlying simulation engine.
