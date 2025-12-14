# TASK015 - Workerized simulation PoC

**Status:** Pending \
**Added:** 2025-12-14 \
**Updated:** 2025-12-14

## Original Request

Move simulation ticks into a Web Worker using transferable typed arrays to reduce main-thread jank at large grid sizes.

## Thought Process

`LifeSphereSim` mixes simulation state and 3D geometry precompute (`THREE.Vector3[]`). For a Worker-based sim, we should separate a pure sim core (typed arrays only) from geometry. A PoC can validate the message protocol and buffer transfer before committing to a larger refactor.

## Implementation Plan

- Create a pure `LifeGridSim` in `src/sim/LifeGridSim.ts` (no `three` import).
- Add a Worker module in `src/workers/simWorker.ts` implementing init/tick/rules/seed messages.
- Add an opt-in toggle (hidden or dev-only initially) to run sim in Worker mode.
- Ensure current texture and instanced rendering can consume worker snapshots.

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks

|  ID | Description                             | Status      | Updated    | Notes                      |
| --: | --------------------------------------- | ----------- | ---------- | -------------------------- |
| 2.1 | Add `LifeGridSim` core                  | Not Started | 2025-12-14 | Separate sim from geometry |
| 2.2 | Implement Worker message protocol       | Not Started | 2025-12-14 | Transfer buffers           |
| 2.3 | Add opt-in wiring in `usePlanetLifeSim` | Not Started | 2025-12-14 | Keep fallback              |
| 2.4 | Add tests for worker protocol           | Not Started | 2025-12-14 | Likely unit tests          |
