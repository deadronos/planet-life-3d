# Active Context — Planet Life 3D

## Current Focus

- Creating or updating the repository `memory/` bank as requested by the user.
- Capture key patterns and technical knowledge so future agents can pick up where this conversation left off.
- Keep the implementation spec `specs/current-state.md` updated as behavior, controls, or architecture changes.

## Recent changes

- The `PlanetLife` component unifies rendering and simulation: `LifeSphereSim` (core logic) provides `positions` and `normals` to the renderer, and `PlanetLife.updateTexture()` flips/write rows for equirectangular mapping.
- `Meteor` and `ImpactRing` components provide interactive visual feedback when the planet is clicked.
- Unit and component tests were added (Vitest) covering `LifeSphereSim`, `parseAsciiPattern`, Meteor, ImpactRing, and PlanetLife components.

## Next steps

- Add a CI workflow to run `npm ci`, `npm run build`, and `npm run test`.
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
