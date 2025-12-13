# [TASK002] - Add Unit Tests for LifeSphereSim

**Status:** Pending
**Added:** 2025-12-13
**Updated:** 2025-12-13

## Original Request
Add a test harness and unit tests for `LifeSphereSim` core functions: `step()`, `pointToCell()`, `parseAsciiPattern()`, and seeding logic.

## Thought Process
- The simulation core is pure TypeScript, making it straightforward to unit test.
- Proposed test runner: Vitest (fast, TypeScript-friendly, runs inside Vite environment), or Jest if preferred.

## Implementation Plan
- Add `vitest` dev dependency and a `test` script to `package.json`.
- Add an initial test file `src/sim/LifeSphereSim.spec.ts` to test `step`, neighbor counts, and `pointToCell()`.
- Add `src/sim/patterns.spec.ts` to test `parseAsciiPattern`.
- Add a minimal GitHub Actions CI workflow to run `npm ci && npm run build && npm test`.

## Progress Log

## Notes
- Keep test coverage focused on deterministic logic; omit UI/three.js rendering tests (which are E2E UI tests and later work).

