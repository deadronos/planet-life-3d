# Active Context — Planet Life 3D

## Current Focus

- Keep the Memory Bank (`memory/`) and the implementation spec (`specs/current-state.md`) in sync with the current code.
- Capture the post-TASK005 architecture: `PlanetLife.tsx` is now a composition layer and the heavy logic lives in `src/components/planetLife/`.
- Track follow-on work after refactor completion (CI, docs drift prevention).

## Recent changes

- **Environment Enhancements (2025-12-14)**: Added immersive space background with 5 new components in `src/components/environment/`:
  - `NebulaSkybox.tsx` — GLSL procedural nebula using FBM noise with animated purple/blue/pink palette
  - `DistantSun.tsx` — Large yellowish star with glow shader and corona effects
  - `DistantMoons.tsx` — Two small moons with independent orbital paths
  - `SunLensFlare.tsx` — Sprite-based lens flare effect following directional light
  - `SpaceEnvironment.tsx` — Wrapper composing all environment elements
- **Planet Visuals (2025-12-14)**: Overhauled `planetMaterial.ts` with custom GLSL shader:
  - World-space lighting to align day/night terminator with the sun.
  - "Sunset" terminator band and atmospheric rim glow.
  - 3D Simplex noise for surface micro-variation.
  - Cell anchoring grid pattern to align with simulation cells.
  - Specular highlights on the ocean for better depth.
- `App.tsx` now uses `SpaceEnvironment` and a cinematic camera position `[-1, -4, -12]`.
- TASK005 completed: `src/components/PlanetLife.tsx` was refactored into a composition layer.
- Refactor (Clustering): Simulation logic clustered into `src/sim/rules.ts` and `src/sim/utils.ts`.
- Refactor (Hooks): `useMeteorSystem` and `useSimulationSeeder` extracted from `PlanetLife.tsx`.
- RULE_PRESETS and COLOR_THEMES were added (see `src/sim/presets.ts`), and `usePlanetLifeControls` now includes `rulePreset` and `theme` selectors that can write `birthDigits`/`surviveDigits` and palette values.
- New private modules were added under `src/components/planetLife/`:
  - `controls.ts` (Leva schema + types)
  - `cellColor.ts` (color mode resolver)
  - `lifeTexture.ts` (`DataTexture` lifecycle + `writeLifeTexture` mapping)
  - `planetMaterial.ts` (`ShaderMaterial` creation)
  - `usePlanetLifeSim.ts` (sim lifecycle + tick loop + render sync)
  - `useMeteorSystem.ts` (meteor/impact logic)
  - `useSimulationSeeder.ts` (seeding logic)
  - `utils.ts` (`uid`, re-exports `safeInt`)
- `Meteor` and `ImpactRing` components provide interactive visual feedback when the planet is clicked.
- Unit and component tests were added (Vitest) covering `LifeSphereSim`, `parseAsciiPattern`, Meteor, ImpactRing, and PlanetLife components.
- Quality gates validated after modularization: `npm run test`, `npm run lint`, `npm run typecheck`.

## Performance improvements (quick wins)

- `usePlanetLifeSim` now skips `DataTexture` writes when `cellRenderMode` is `Dots` (avoids full RGBA rewrite + GPU upload each tick when overlay is hidden).
- Instanced mesh buffers are marked with `THREE.DynamicDrawUsage` to better match frequent per-tick updates.
- `Meteor` avoids per-frame temporary allocations and uses squared-distance collision checks.

Validated: `npm run test`, `npm run lint`, `npm run typecheck`.

## Next steps

- Add a CI workflow to run `npm ci`, `npm run build`, and `npm run test`.
- Keep `specs/current-state.md` updated when the module boundaries change.
- Add task entries in `memory/tasks` for TODOs prioritized by value (docs, accessibility, pattern editor).
- Consider local persistence for theme/preset selection and a small UI hint for 'Custom' modes.

## Notes for maintainers

- The simulation uses typed arrays and precomputed geometry positions to keep per-frame overhead low.
- Keep Leva UI knobs and safe value guards in place — user controls can briefly produce invalid values while editing.
- Environment components use GLSL shaders; changes to nebula colors or sun glow require shader modifications.

## Docs sync policy

- When changing simulation logic, rendering mapping, UI controls, or core dependencies, update `specs/current-state.md` and the relevant `memory/` files in the same PR.
- If the spec and Memory Bank disagree, treat it as documentation drift and correct it immediately.

## Update

- TASK001: Create memory bank — core `memory` files and an initial task index were added to the repository.
- TASK005: Refactor `PlanetLife.tsx` into smaller modules — completed and validated.
- TASK006: Add rule presets and color themes — completed (see `src/sim/presets.ts`, updated controls and patterns).
- **2025-12-14**: Environment enhancements — procedural nebula skybox, distant sun, orbiting moons, and lens flare added.
