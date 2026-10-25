# Simulation & rendering invariants

These are easy to break accidentally; please preserve them unless you are intentionally changing behavior.

## Performance invariants

- Prefer typed arrays (`Uint8Array`) for hot grid buffers.
- Preserve precomputed `positions` / `normals` patterns in the sim for performance.

## Defensive input handling

- Keep `safeInt`, `safeFloat`, and clamping guards.
- Rationale: UI controls (Leva) can emit transient invalid values during editing.

## Indexing / mapping invariants

- Longitude wraps; latitude clamps (no wrap at the poles).
- Both CPU/worker and GPU textures store sim lon `lo` directly at texel column `lo`, and the
  overlay vertex shader mirrors U (`vUv.x = 1.0 - uv.x`) to compensate for three.js
  SphereGeometry UVs running opposite to the sim's longitude mapping. Do NOT also reverse
  columns in `writeLifeTexture` — that double-flip mirrors the rendered life east-west.
- Instanced mesh sizing is tied to `maxInstances = latCells * lonCells`; keep allocation/updates aligned.

## CPU / GPU parity invariants

- The GPU sim (`src/shaders/simulation.frag.ts`) must mirror the CPU's
  `adjustNeighborsForEcology` (profile biases + neighbor-count bias) or the two sims run
  different rules. When changing `computeEcologySample`, port the same formulas to the shader.
- Colony birth typing must match: a new cell becomes Colony A when at least 2 neighbors are
  Colony A (`LifeGridSimColony` and the GPU shader agree on `countA >= 2`).
- When `gpuSim` is enabled the CPU/worker sim is paused and its stats are never published;
  HUD stats come from the GPU sim's readback pass (`gpuStats.frag.ts`).

## Seeded randomize / shareable worlds

- Randomize draws from `createSeededRng(worldSeed)` (`src/sim/seededRng.ts`, mulberry32). CPU
  (`LifeGridSimBase.randomize`), worker (`seed` in the `init`/`randomize` messages) and GPU init
  (`useGpuSeeder.initializeState`, which builds its texture on the CPU) use the same generator and
  draw order (one draw per cell, one more per live Colony cell), so a seed gives the same pattern
  on every path. `worldSeed` lives in `useUIStore`; `requestSimCommand('randomize')` picks a fresh one.
- The share hash (`src/utils/shareUrl.ts`) is applied in `main.tsx` before first render; the preset
  is applied first so explicit params win. Meteor seeding (`seedAtUV` shader) is not seeded.
