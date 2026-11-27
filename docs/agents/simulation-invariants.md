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
  `computeEcologySample` (profile biases, `neighborBias`, and `colonyAffinity`) or the two sims
  run different rules. When changing `computeEcologySample`, port the same formulas to
  `ecologySample()` in the shader.
- Colony birth typing must match across CPU (`LifeGridSimColony`), Worker (`lifeGridWorkerImpl`),
  and GPU (`simulation.frag.ts`):
  - Majority-wins: `countA > countB` births Colony A, `countB > countA` births Colony B.
  - When `countA === countB`, if `colonyBiomeAffinity` is active with ecology (`colonyAffinity !== 0`),
    warm/wet lowlands (`colonyAffinity > 0`) break ties toward Colony A and cold/highland ridges
    (`colonyAffinity < 0`) break ties toward Colony B; otherwise a deterministic parity tie-breaker
    `((lat + lon + generation) & 1) === 0` selects Colony A vs Colony B (passed to the GPU via
    `uGeneration`).
  - When `colonyBiomeAffinity` is active with ecology, effective neighbor counts are shifted by
    `clamp(baseBias + speciesSign * colonyAffinity, -1, 1)` (`+1` for Colony A, `-1` for Colony B)
    for both survival and candidate birth checks.
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
