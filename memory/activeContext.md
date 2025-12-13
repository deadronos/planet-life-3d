# Active Context — Planet Life 3D

**Current Focus**

- Creating or updating the repository `memory/` bank as requested by the user.
- Capture key patterns and technical knowledge so future agents can pick up where this conversation left off.

**Recent changes**

- The `PlanetLife` component unifies rendering and simulation: `LifeSphereSim` (core logic) provides `positions` and `normals` to the renderer, and `PlanetLife.updateTexture()` flips/write rows for equirectangular mapping.
- `Meteor` and `ImpactRing` components provide interactive visual feedback when the planet is clicked.

**Next steps**

- Add tests for `LifeSphereSim.step()`, `pointToCell()`, `parseAsciiPattern()` and seeding logic.
- Add task entries in `memory/tasks` for TODOs prioritized by value.
- Consider CI integration: unit tests + TypeScript check + vite build.

**Notes for maintainers**

- The simulation uses typed arrays and precomputed geometry positions to keep per-frame overhead low.
- Keep Leva UI knobs and safe value guards in place — user controls can briefly produce invalid values while editing.

**Update**

- TASK001: Create memory bank — core `memory` files and an initial task index were added to the repository.
