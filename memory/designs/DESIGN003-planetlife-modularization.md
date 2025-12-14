# DESIGN003 — Modularize `PlanetLife.tsx`

## Goal

Refactor `src/components/PlanetLife.tsx` into smaller, focused modules (hooks + helpers + small presentational subcomponents) while preserving behavior and performance.

## Context & Constraints

- `PlanetLife.tsx` currently mixes: Leva controls, sim lifecycle + tick loop, DataTexture writes, instanced mesh updates, meteor/impact orchestration, and planet shader material.
- Hot paths must stay allocation-light (typed arrays, reused `THREE.Color` scratch, minimal per-tick object creation).
- Keep external API stable: callers should keep importing `PlanetLife` from `src/components/PlanetLife.tsx`.
- Maintain rendering parity between `Texture` and `Dots` modes.
- Preserve the existing texture mapping invariants (lat row mapping and lon column flip).

## Refactor Principles

1. **Separate concerns, keep data close**: move non-React helpers to pure modules; keep React stateful parts in custom hooks.
2. **No behavioral changes in early phases**: first extraction should be mechanical and diff-friendly.
3. **Preserve performance characteristics**: no new arrays inside tick loops; memoize `THREE.Color`, `THREE.Vector3` scratch objects.
4. **Stable resource lifetimes**: textures/materials must be created/disposed deterministically.

## Proposed Module Layout

Create a private subfolder `src/components/planetLife/` (lowercase) and keep the public entry component in `src/components/PlanetLife.tsx`.

### Controls

- File: `src/components/planetLife/controls.ts`
- Responsibility: define the control types and the Leva schema.
- Exports:
  - `PlanetLifeControls` type (and `DebugControls` if needed)
  - `usePlanetLifeControls(): PlanetLifeControls & { debugLogs: boolean }`
- Notes: keeping Leva in one place makes the main component readable and reduces accidental dependency creep.

### Cell Coloring

- File: `src/components/planetLife/cellColor.ts`
- Responsibility: encapsulate color-mode logic for both texture + instanced mesh.
- Exports:
  - `useCellColorResolver(params): (idx, ageView, heatView, target) => intensity`
- Inputs: `cellColorMode`, `cellColor`, `ageFadeHalfLife`, `heatLowColor`, `heatMidColor`, `heatHighColor`.

### Life Overlay Texture

- File: `src/components/planetLife/lifeTexture.ts`
- Responsibility: create/dispose the `THREE.DataTexture` and provide the write/update helper.
- Exports:
  - `useLifeTexture({ latCells, lonCells }): { data, tex, w, h }`
  - `writeLifeTexture({ grid, ages, heat, lifeTex, resolveCellColor, colorScratch, debugLogs })`
- Notes:
  - Keep row mapping and lon flip exactly as today.
  - The write helper should be pure w.r.t. allocations (no new arrays; only mutate `Uint8Array`).

### Planet Shader Material

- File: `src/components/planetLife/planetMaterial.ts`
- Responsibility: create/dispose the `THREE.ShaderMaterial` and keep uniforms in sync with controls.
- Exports:
  - `usePlanetMaterial(params): THREE.ShaderMaterial`
- Notes:
  - Centralizes shader strings and uniform update logic.
  - Keeps the main component JSX focused on scene graph structure.

### Simulation Lifecycle + Rendering Sync

- File: `src/components/planetLife/usePlanetLifeSim.ts`
- Responsibility: own `LifeSphereSim` creation/recreation, tick loop, and rendering synchronization.
- Exports:
  - `usePlanetLifeSim({ controls, rules, lifeTex, cellsRef, dummy, resolveCellColor, colorScratch }): { simRef, updateInstances, seedAtPoint, clear, randomize, stepOnce }`
- Notes:
  - Encapsulate the “recreate sim on size/radius/lift” behavior.
  - Encapsulate “update rules without resetting grid”.
  - Encapsulate store stats update via `useUIStore.getState().setStats(...)`.

### Meteors + Impacts Orchestration

Option A (minimal): keep state in `PlanetLife.tsx` but move spec construction helpers to pure modules.

Option B (cleaner): extract state handling.

- Files:
  - `src/components/planetLife/useMeteors.ts`
  - `src/components/planetLife/useImpacts.ts`
- Exports:
  - `useMeteors({ planetRadius, meteor controls, onImpactPoint }): { meteors, onPlanetPointerDown, onMeteorImpact }`
  - `useImpacts({ ...impact controls }): { impacts, pushImpactAtPoint }`

## Public Component Shape (Post-Refactor)

`src/components/PlanetLife.tsx` becomes a thin composition layer:

- call `usePlanetLifeControls()`
- derive `rules` from digits
- create `dummy`, `cellsRef`
- get `lifeTex` + `planetMaterial`
- get `resolveCellColor` + scratch color
- wire sim hook and meteor/impact hooks
- render: planet mesh + atmosphere mesh + life overlay + instanced cells + meteors + rings

## Validation Plan

- Automated: `npm run test`, `npm run lint`, `npm run typecheck`.
- Manual:
  - Toggle `Texture/Dots/Both`, verify parity.
  - Toggle color modes (`Solid`, `Age Fade`, `Neighbor Heat`).
  - Fire meteors, verify seeding and impact visuals.
  - Change `latCells/lonCells`, confirm sim recreates and texture remains mapped correctly.

## Risks / Gotchas

- Hook dependency arrays: splitting logic increases the chance of stale closures or over-triggered effects.
- Resource disposal: ensure `DataTexture` and `ShaderMaterial` still dispose on unmount and on re-creation.
- TypeScript ergonomics with Leva: keep existing casting strategy localized in the controls module.

## Migration Strategy

1. Extract pure helpers (uid/safeInt/cellColor/writeLifeTexture) without changing runtime behavior.
2. Extract `usePlanetMaterial` and `useLifeTexture` (resource lifecycle is easiest to validate).
3. Extract sim lifecycle hook (largest change) while keeping function signatures stable.
4. Optional: extract meteor/impact hooks.

## Implementation Status

- Implemented (TASK005): `src/components/planetLife/controls.ts`, `cellColor.ts`, `lifeTexture.ts`, `planetMaterial.ts`, `usePlanetLifeSim.ts`, `utils.ts`.
- Kept orchestration local (by design): meteor + impact state remains in `src/components/PlanetLife.tsx`.
