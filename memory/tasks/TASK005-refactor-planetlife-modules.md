# [TASK005] - Refactor `PlanetLife.tsx` into Smaller Modules

**Status:** Completed
**Added:** 2025-12-14
**Updated:** 2025-12-14

## Original Request

Suggest a refactor of `src/components/PlanetLife.tsx` into smaller modules, and create a design + implementation plan.

## Thought Process

- `PlanetLife.tsx` currently bundles multiple responsibilities (controls, sim lifecycle, texture writes, instancing, shaders, meteors/impacts). This makes change-risk high and slows iteration.
- Splitting by concern (controls / rendering resources / sim loop / effects orchestration) improves readability and makes it easier to unit-test pure logic.
- The refactor must be performance-neutral: the simulation tick and render sync paths should not introduce new allocations.

## Design Reference

- DESIGN003 — Modularize `PlanetLife.tsx` (`memory/designs/DESIGN003-planetlife-modularization.md`)

## Implementation Plan

1. **Prep / safety net**
   - Ensure current behavior is covered by existing tests (component + unit).
   - Add small targeted unit tests only if gaps are found around newly-extracted pure helpers.

2. **Phase 1: Mechanical extraction (no behavior change)**
   - Extract pure helpers from `PlanetLife.tsx` into `src/components/planetLife/*` (e.g., `uid`, `safeInt`, texture write helper, cell-color resolver).
   - Keep exported `PlanetLife` component signature unchanged.

3. **Phase 2: Resource hooks**
   - Extract `useLifeTexture` (creates/disposes `DataTexture`).
   - Extract `usePlanetMaterial` (creates/disposes shader material; updates uniforms via effects).
   - Verify disposal happens correctly on unmount.

4. **Phase 3: Simulation lifecycle hook**
   - Extract sim creation/recreation, tick loop, and render-sync (`updateInstances` / `updateTexture`) into `usePlanetLifeSim`.
   - Keep invariants intact:
     - Texture mapping (lat row semantics + lon flip)
     - Dots/Texture parity
     - Typed-array usage in hot loops

5. **Phase 4: Optional ergonomics**
   - Extract meteor/impact state management into hooks if it improves clarity without increasing prop churn.

6. **Validation**
   - Run `npm run test`, `npm run lint`, `npm run typecheck`.
   - Manual checks: switch `Texture/Dots/Both`, switch color modes, fire meteors, resize grid.

## Acceptance Criteria

- `src/components/PlanetLife.tsx` becomes a composition-only file (noticeably smaller) and delegates concerns to modules under `src/components/planetLife/`.
- No observable behavior regressions in:
  - simulation tick
  - texture overlay mapping
  - dots rendering
  - meteor impact seeding and visuals
- CI-quality checks pass: tests, lint, and typecheck.

## Progress Log

- 2025-12-14: Added DESIGN003 and recorded refactor plan (TASK005).
- 2025-12-14: Implemented modularization under `src/components/planetLife/`; validated with `npm run test`, `npm run lint`, `npm run typecheck`.
