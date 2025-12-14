# DESIGN006 — Performance Scalability (Scheduler, Benchmarks, Worker PoC)

**Status:** Draft \
**Added:** 2025-12-14 \
**Updated:** 2025-12-14

## Analyze

### Problem

The current architecture is already performance-aware (typed arrays, instancing, conditional texture writes). However, at large grid sizes, the simulation tick and full `DataTexture` rewrite can cause main-thread jank.

### Requirements (EARS)

- WHEN `running=true` and the simulation tick time exceeds `tickMs`, THE SYSTEM SHALL avoid timer backlog and schedule ticks in a non-overlapping way. **Acceptance:** under intentionally small `tickMs` (e.g. 1–5ms), the app remains responsive and does not attempt to “catch up” by running stacked callbacks.

- WHEN developers want to track performance over time, THE SYSTEM SHALL provide a reproducible benchmark harness for `LifeSphereSim.step()` across multiple grid sizes. **Acceptance:** `npm run bench` prints benchmark results and exits successfully.

- WHEN the simulation becomes CPU-bound at large grid sizes, THE SYSTEM SHALL support a Worker-based simulation tick path (PoC) that keeps UI interactions responsive. **Acceptance:** a Worker mode can tick and return grids while the main thread stays interactive.

- WHEN rendering mode is `Dots`, THE SYSTEM SHALL avoid full `DataTexture` writes. **Acceptance:** existing behavior remains (already implemented).

### Non-goals

- Perfect, CI-stable performance regression gating (hardware variance makes strict budgets flaky).
- Switching the rendering pipeline to GPU compute.

## Design

### Overview

This design introduces three incremental improvements:

1. **Tick scheduler fix (small, safe):** replace `setInterval` with a self-scheduling loop that never queues overlapping work.
2. **Benchmark harness (low-risk):** add a `vitest bench` suite to measure `LifeSphereSim.step()`.
3. **Worker PoC (larger change):** move the simulation tick to a Web Worker and stream buffers back.

### 1) Tick scheduler (non-overlapping)

Current approach: `setInterval(() => sim.step(); updateInstances(), tickMs)` in `usePlanetLifeSim`.

Issue: if a tick takes longer than `tickMs`, interval callbacks queue up and execute back-to-back, causing long frame stalls.

Proposed:

- Use a self-scheduling `setTimeout` loop.
- Track a target time `nextAt` so the loop still roughly respects `tickMs`, but clamp so it never tries to “catch up” by running multiple ticks in one event loop turn.

Pseudo:

```ts
let cancelled = false;
let nextAt = performance.now();

async function loop() {
  if (cancelled) return;
  const now = performance.now();
  const delay = Math.max(0, nextAt - now);
  window.setTimeout(() => {
    if (cancelled) return;
    const sim = simRef.current;
    if (!sim) return;
    sim.step();
    // stats + updateInstances
    nextAt = performance.now() + tickMs;
    loop();
  }, delay);
}
```

### 2) Benchmark harness

Use Vitest’s benchmark mode.

- Add a `tests/bench/LifeSphereSim.bench.ts` using `bench()`.
- Add `npm run bench` which invokes `vitest bench`.

Notes:

- Benchmarks are informative and can be run locally or in CI; avoid failing the build on strict timings.
- The bench should run a few warmup iterations and include multiple sizes.

### 3) Worker PoC (message protocol)

#### Motivation

Offloading the `step()` hot loop reduces main-thread stalls (camera controls, UI, rendering).

#### Key constraint

`LifeSphereSim` currently depends on `three` and precomputes `Vector3[]` positions/normals, which are not transferable and are not needed for worker simulation.

#### Proposed refactor (PoC)

- Introduce a **pure** sim core that owns only typed arrays and rules:
  - `LifeGridSim` (no `three` import)
  - Methods: `step()`, `setRules()`, `randomize()`, `seedAtCell()` and accessors returning `Uint8Array` views.
- Keep geometry precompute on main thread (positions/normals).

#### Worker messages

- `init`: { latCells, lonCells, rules, randomDensity }
- `setRules`: { rules }
- `tick`: { steps?: number }
- `seedAtPoint`: { lat, lon, offsets, mode, scale, jitter, probability }
- `snapshot` response: { grid: ArrayBuffer, age: ArrayBuffer, heat: ArrayBuffer, generation, population, birthsLastTick, deathsLastTick }

Transfer strategy:

- Worker sends buffers via `postMessage(payload, [grid.buffer, age.buffer, heat.buffer])`.
- Main thread receives and wraps them in typed arrays.
- Use double-buffering inside worker to avoid allocating each tick.

### Error matrix

| Scenario                             | Expected behavior           | Handling                             |
| ------------------------------------ | --------------------------- | ------------------------------------ |
| `tickMs` is 0/NaN                    | Use a safe minimum delay    | Clamp `tickMs` in scheduler          |
| Worker fails to start                | Fallback to main-thread sim | Feature flag + try/catch             |
| Worker out-of-date after grid resize | Re-init worker              | terminate + recreate on size changes |
| Transfer errors (buffer detached)    | Recreate buffers            | reset path and log (debug)           |

## Validate

- `npm run test` for correctness
- `npm run lint` and `npm run typecheck`
- `npm run bench` for perf visibility

## Reflect

- If Worker PoC is successful, consider moving texture write into Worker when in Texture mode (tradeoff: bigger transfers).

## Handoff

- Update `specs/current-state.md` to note scheduler behavior and benchmarks.
