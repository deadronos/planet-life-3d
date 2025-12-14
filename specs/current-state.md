# Planet Life 3D — Current Implementation Spec

Date: 2025-12-14  
Branch: feature/presets-and-themes-10342195161337007315 (recent changes)  
Scope: Describes the current architecture, behaviors, data flow, and interfaces implemented in the repository.

## Overview

Planet Life 3D is a single-page React + TypeScript application that renders a spherical cellular automata simulation (Conway-like rules) using three.js and @react-three/fiber. The simulation grid is defined over latitude/longitude on a sphere, updated on a configurable interval, and visualized via either a texture overlay or instanced dot mesh.

- Core simulation: `src/sim/LifeSphereSim.ts`, `src/sim/rules.ts`, `src/sim/utils.ts`
- Patterns and ASCII parsing: `src/sim/patterns.ts`
- Rendering & UI (composition): `src/components/PlanetLife.tsx`
- Rendering & UI (private modules): `src/components/planetLife/*`
- **Environment (space background)**: `src/components/environment/*`
- Interactions: `src/components/Meteor.tsx`, `src/components/ImpactRing.tsx`
- App entry: `src/App.tsx`, `src/main.tsx`
- UI state: `src/store/useUIStore.ts`

## Tech Stack

- React 19 (currently 19.2.x), TypeScript 5, Vite 7
- three.js and @react-three/fiber
- leva (control panel)
- Vitest (unit/component tests), Playwright guidance present for e2e

## Architecture

### Simulation (LifeSphereSim)

- Grid dimensions: `latCells × lonCells` with wrap-around longitude and clamped latitude (no wrap at poles).
- Buffers: `Uint8Array` for `grid` and `next` to maintain performance in hot loops.
- Rules: `birth[]` and `survive[]` boolean lookup tables (length 9) derived from digits strings (e.g., birth "3", survive "23").
- Precomputed geometry: `normals[]` and `positions[]` arrays holding vector data for each cell, based on `planetRadius` and `cellLift`.
- Step algorithm: Iterates every cell, counts neighbors in the 8-neighborhood (with lon wrapping, lat clamped), applies rules to produce `next`, then swaps buffers.
- Seeding: Supports `seedAtCell()` and `seedAtPoint()` with modes `set | toggle | clear | random`, scaling, jitter, and probability.
- Point-to-cell mapping: Normalizes a 3D point to a unit vector, converts to spherical coordinates, then maps to discrete lat/lon indices.

### Rendering & UI (PlanetLife)

- Composition + modules: `src/components/PlanetLife.tsx` is now primarily orchestration (meteors/impacts + wiring), while the heavy logic is extracted into `src/components/planetLife/`.
- Control panel (`leva`): defined in `src/components/planetLife/controls.ts` via `usePlanetLifeControls()`.
- Texture overlay: equirectangular `THREE.DataTexture` sized `lonCells × latCells` mapped to the planet UVs. The write loop lives in `writeLifeTexture()` and reverses the longitude column (`dstLo = w - 1 - lo`) to align sim indexing and three.js UV orientation.
- Instanced dots: Alive cells are rendered via an `InstancedMesh` sphere geometry; only alive instances are written each update.
- Sync strategy: `usePlanetLifeSim().updateInstances()` updates the DataTexture only when the overlay is actually visible (`cellRenderMode` is `Texture` or `Both`) and updates the instanced mesh (if present). `tex.needsUpdate` and `instanceMatrix.needsUpdate` are set precisely.
- Tick loop: `setInterval` driven by `tickMs` when `running=true` inside `usePlanetLifeSim()`. After `sim.step()`, stores stats to `useUIStore` and triggers render sync.

#### PlanetLife module boundaries

- `src/components/planetLife/usePlanetLifeSim.ts`: sim creation/recreation, tick loop, stats updates, texture + instanced mesh sync.
- `src/components/planetLife/useMeteorSystem.ts`: meteor spawning, impacts, and visual rings.
- `src/components/planetLife/useSimulationSeeder.ts`: pattern selection and seeding execution.
- `src/components/planetLife/lifeTexture.ts`: `useLifeTexture()` and `writeLifeTexture()`.
- `src/components/planetLife/planetMaterial.ts`: `usePlanetMaterial()`.
- `src/components/planetLife/cellColor.ts`: `useCellColorResolver()`.
- `src/components/planetLife/controls.ts`: `usePlanetLifeControls()`.
- `src/components/planetLife/utils.ts`: `uid()`, re-exports `safeInt()`.

### Environment (`src/components/environment/`)

Space environment components providing an immersive background:

- `SpaceEnvironment.tsx`: Wrapper composing all environment elements; receives `lightPosition` prop from `App.tsx`.
- `NebulaSkybox.tsx`: Large inverted sphere (radius 150, `BackSide`) with GLSL shader using FBM simplex noise for animated purple/blue/pink nebula clouds.
- `DistantSun.tsx`: Yellowish star with glow shader (fresnel-based) and corona layers; positioned at 10× the light direction (default: `[60, 60, 80]`), size 12 units.
- `DistantMoons.tsx`: Two spheres with independent orbital speeds (0.02, 0.015 rad/s) and tilts; distances 55 and 70 units.
- `SunLensFlare.tsx`: Sprite-based lens flare with procedurally generated canvas textures; elements positioned along screen-center-to-light vector.
- `index.ts`: Barrel export for all environment components.

### Interactions

- Planet pointer: `onPointerDown` spawns a meteor traveling from camera towards the hit point; respects `meteorCooldownMs`.
- Meteor impact: On impact, seeds the simulation at the hit location with the currently selected pattern and adds a visual impact ring.
- Seed patterns: Built-in ASCII patterns (`Cross`, `Glider`, `Exploder`, `Ring`, `Solid`, `R-pentomino`, `Diehard`, `Acorn`, `LWSS`), `Custom ASCII` via text input, and `Random Disk` generated procedurally from `seedScale`.

### State Management

- Global UI stats: `useUIStore` holds generation, population, and per-tick birth/death counts updated every tick.
- Component-local state: `PlanetLife` maintains `meteors` and `impacts` arrays.

## Data Flow

1. Controls update simulation parameters and rendering options.
2. Simulation ticks (`step()`) compute next state.
3. UI stats update via `useUIStore`.
4. Rendering sync writes alive cells into:
   - DataTexture (overlay), with longitude reversed per column.
   - Instanced mesh matrices for alive instances.
5. User interactions (pointer → meteor) cause `seedAtPoint()` and add visual effects.

## Interfaces & Contracts

### Simulation Rules & Seeding

- `type SeedMode = 'set' | 'toggle' | 'clear' | 'random'`
- `type Rules = { birth: boolean[]; survive: boolean[] }` (length 9 for neighbor counts 0..8)

### LifeSphereSim Public API (selected)

- `constructor({ latCells, lonCells, planetRadius, cellLift, rules })`
- `setRules(rules: Rules): void`
- `getCell(lat: number, lon: number): 0 | 1`
- `setCell(lat: number, lon: number, value: 0 | 1): void`
- `clear(): void`
- `randomize(density: number, rng?: () => number): void`
- `step(): void`
- `pointToCell(point: THREE.Vector3): { lat: number; lon: number }`
- `seedAtCell({ lat, lon, offsets, mode, scale, jitter, probability, rng, debug }): void`
- `seedAtPoint({ point, offsets, mode, scale, jitter, probability, rng, debug }): void`
- `forEachAlive(fn: (idx: number) => void): void`
- `getGridView(): Uint8Array`

### Patterns

- `parseAsciiPattern(ascii: string): Offset[]` — Parses ASCII art; live chars: `O o X x # 1 @`.
- `getBuiltinPatternOffsets(name: string): Offset[]` — Returns offsets for named built-in patterns.

## Controls & Parameters (PlanetLife)

- Simulation: `running`, `tickMs`, `latCells`, `lonCells`, `birthDigits`, `surviveDigits`, `rulePreset` (default: `Conway`), `randomDensity`
- Rendering: `planetRadius`, `planetWireframe`, `planetRoughness`, `cellRenderMode` (`Texture | Dots | Both`), `cellOverlayOpacity`, `cellRadius`, `cellLift`, `cellColor`
- Upgrades / Themes: `theme` (default: `Default`) plus palette values (`cellColor`, `atmosphereColor`, `heatLowColor`, `heatMidColor`, `heatHighColor`, `impactRingColor`)
- Meteors: `meteorSpeed`, `meteorRadius`, `meteorCooldownMs`
- Seeding: `seedMode`, `seedPattern`, `seedScale`, `seedJitter`, `seedProbability`, `customPattern`
- Actions: `Randomize`, `Clear`, `StepOnce`
- Debug: `debugLogs`

## Invariants & Defensive Guards

- Numeric inputs are validated/clamped (`safeInt`, `safeFloat`) to prevent invalid array sizes and out-of-range values.
- Longitude wraps modulo; latitude clamps to grid bounds (no pole wrap).
- DataTexture row mapping intentionally reverses longitude indexing to match three.js sphere UVs.
- Typed arrays and precomputed vectors are used to avoid allocations in hot paths.

## Performance Notes

- `Uint8Array` buffers and precomputed `positions`/`normals` reduce per-tick overhead.
- Texture and instance updates are batched during `updateInstances()`.
- Texture writes (full RGBA buffer fill + GPU upload) are skipped when `cellRenderMode` is `Dots`.
- Instanced mesh updates use `THREE.DynamicDrawUsage` for instance matrices/colors to better match the frequent update pattern.
- Meteor update loop avoids per-frame temporary allocations and uses squared-distance collision checks.
- Instanced mesh renders only alive cells (`mesh.count` set dynamically).

## Testing & Validation

- Unit tests exist for `LifeSphereSim` and `patterns` under `tests/unit`.
- Component tests exist under `tests/component` (note: `PlanetLife.test.tsx` was updated to mock `leva` controls and to assert default render mode is `Texture`).
- E2E guidance documented; Playwright instructions are present but e2e tests may be minimal.
- Type checking via `npm run build` runs `tsc -b` before Vite.

## Recent Refactor Notes

- TASK005 (PlanetLife modularization) completed and validated: `npm run test`, `npm run lint`, `npm run typecheck`.

## Build & Run

```bash
npm install
npm run dev      # Start Vite dev server
npm run build    # Type-check + production build
npm run preview  # Preview production build
npm run test     # Run Vitest suite
```

## Known Behaviors & Limitations

- Large grids (high `latCells` × `lonCells`) increase CPU/GPU cost; tune `tickMs` accordingly.
- Latitude clamping leads to fewer neighbors at poles; this is by design.
- Texture overlay longitude reversal is required; changes to indexing must preserve this mapping.
- UI controls can briefly provide invalid values; defensive guards exist to keep simulation stable.

## Extension Hooks

- Add new built-in patterns in `src/sim/patterns.ts` and reuse `parseAsciiPattern`.
- Add or modify rule presets and color themes in `src/sim/presets.ts` and wire them into `usePlanetLifeControls()` for UX-friendly presets.
- Modify rules parsing or neighbor logic in `LifeSphereSim`.
- Update rendering parity across `Texture` and `Dots` modes when changing overlay logic.
- Expose additional parameters via `leva` controls in `PlanetLife`.

## Decision Records & Architecture Notes

- Wrap-around longitude and clamped latitude chosen for simplicity and performance.
- Two rendering modes maintained in sync to support visual flexibility.
- Typed arrays and precomputations prioritized for performance-critical paths.
