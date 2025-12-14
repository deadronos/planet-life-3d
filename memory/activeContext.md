# Active Context — Planet Life 3D

## Current Focus

- Keep the Memory Bank (`memory/`) and the implementation spec (`specs/current-state.md`) in sync with the current code.
- Capture the post-TASK005 architecture: `PlanetLife.tsx` is now a composition layer and the heavy logic lives in `src/components/planetLife/`.
- Track follow-on work after refactor completion (CI, docs drift prevention).

## Recent changes

- TASK005 completed: `src/components/PlanetLife.tsx` was refactored into a composition layer.
- Refactor (Clustering): Simulation logic clustered into `src/sim/rules.ts` and `src/sim/utils.ts`.
- Refactor (Hooks): `useMeteorSystem` and `useSimulationSeeder` extracted from `PlanetLife.tsx`.
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

## Next steps

- Add a CI workflow to run `npm ci`, `npm run build`, and `npm run test`.
- Keep `specs/current-state.md` updated when the module boundaries change.
- Add task entries in `memory/tasks` for TODOs prioritized by value (patterns, docs, accessibility).
- Add more builtin patterns and pattern management UI improvements.

## Notes for maintainers

- The simulation uses typed arrays and precomputed geometry positions to keep per-frame overhead low.
- Keep Leva UI knobs and safe value guards in place — user controls can briefly produce invalid values while editing.

## Docs sync policy

- When changing simulation logic, rendering mapping, UI controls, or core dependencies, update `specs/current-state.md` and the relevant `memory/` files in the same PR.
- If the spec and Memory Bank disagree, treat it as documentation drift and correct it immediately.

## Update

- TASK001: Create memory bank — core `memory` files and an initial task index were added to the repository.
- TASK005: Refactor `PlanetLife.tsx` into smaller modules — completed and validated.
