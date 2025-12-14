# TASK014 - Tick scheduler + perf benchmark harness

**Status:** Completed \
**Added:** 2025-12-14 \
**Updated:** 2025-12-14

## Original Request

Add performance scalability improvements:

- Prevent tick backlog/overlap when `tickMs` is smaller than a tick duration.
- Add a benchmark/test harness to measure `LifeSphereSim.step()` for multiple grid sizes to help catch regressions.

## Thought Process

The safest, highest-value changes are:

1. Replace `setInterval` with a self-scheduling loop so the app doesn’t queue multiple ticks when `step()` is slow.
2. Add `vitest bench` benchmarks that can be run locally (and optionally in CI) without making tests flaky.

## Implementation Plan

- Update `src/components/planetLife/usePlanetLifeSim.ts` tick loop to use a non-overlapping scheduler.
- Add `tests/bench/LifeSphereSim.bench.ts`.
- Add `npm run bench` script (and optionally `bench:ui`).

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

|  ID | Description                                           | Status   | Updated    | Notes                                       |
| --: | ----------------------------------------------------- | -------- | ---------- | ------------------------------------------- |
| 1.1 | Switch tick loop to non-overlapping scheduler         | Complete | 2025-12-14 | Self-scheduling `setTimeout` avoids backlog |
| 1.2 | Add Vitest benchmark suite for `LifeSphereSim.step()` | Complete | 2025-12-14 | Added `tests/bench/LifeSphereSim.bench.ts`  |
| 1.3 | Add `npm run bench` script                            | Complete | 2025-12-14 | Uses `vitest bench --run`                   |
| 1.4 | Validate `test/lint/typecheck`                        | Complete | 2025-12-14 | Ran full suite successfully                 |

## Progress Log

### 2025-12-14

- Implemented non-overlapping tick scheduler in `usePlanetLifeSim`.
- Added `vitest bench` harness and `npm run bench`.
- Validated: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run bench`.
