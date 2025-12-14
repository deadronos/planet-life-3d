# System Patterns & Architecture — Planet Life 3D

## Architecture overview

- A client-only React application (Vite) using TypeScript and Three.js.
- Rendering is built on `@react-three/fiber` — scene is React-managed but the simulation is contained in a pure TS class.
- `LifeSphereSim` is the single source of truth for the grid state; it is not a React component and is deliberately testable and pure.
- `src/components/PlanetLife.tsx` is a composition layer that wires together controls, resources, sim lifecycle, and interaction VFX.
- `src/components/planetLife/` contains the private hooks/helpers that implement the heavy lifting.
- `src/components/environment/` contains the space environment components (skybox, sun, moons, lens flare).
- Simulation logic is modular: core (`LifeSphereSim`), rules (`rules.ts`), and utils (`utils.ts`).

## Key patterns

- Precompute geometry data (positions, normals) and keep it immutable — reduces GC pressure and per-frame allocation.
- Use typed arrays (Uint8Array) for grid state and texture data to make updates fast and memory efficient.
- Map the sim lat/lon grid to an equirectangular DataTexture (`THREE.DataTexture`) to exploit GPU speed for the overlay.
- Keep per-frame UI work minimal; all heavy loops and logic live in `LifeSphereSim`.
- Two rendering modes: `Texture` (DataTexture overlay) and `Dots` (instanced mesh), and they must stay in sync.
- Defensive guards (safeInt, safeFloat) to resist transient invalid inputs from UI controls.
- **Environment shaders**: GLSL shaders for procedural nebula (FBM noise) and sun glow (fresnel-based) — animated via `useFrame`.

## Environment components (`src/components/environment/`)

- `SpaceEnvironment.tsx` — Wrapper composing all environment elements; receives `lightPosition` prop.
- `NebulaSkybox.tsx` — Large inverted sphere with GLSL shader using FBM noise for animated nebula clouds.
- `DistantSun.tsx` — Yellowish star with glow shader and corona layers positioned at 10x light direction.
- `DistantMoons.tsx` — Two moons with independent orbital speeds/tilts, updated via `useFrame`.
- `SunLensFlare.tsx` — Sprite-based lens flare with procedurally generated textures, follows light position.

## Integration points

- `LifeSphereSim.getGridView()` — read-only view used to populate the DataTexture.
- `LifeSphereSim.forEachAlive()` — optimized iterator used while setting instance matrices for alive cells.
- `LifeSphereSim.seedAtPoint()` / `seedAtCell()` — used by the UI and meteors to alter the grid.
- `usePlanetLifeSim()` — owns sim creation/recreation, tick loop, and render sync (texture + instanced mesh).
- `useLifeTexture()` + `writeLifeTexture()` — owns `DataTexture` lifecycle and preserves the lon-flip texture mapping.
- `usePlanetMaterial()` — creates the planet `ShaderMaterial`.
- `useMeteorSystem()` — encapsulates meteor spawning, state management, and visual impact effects.
- `useSimulationSeeder()` — handles pattern selection (ASCII/procedural) and executes `seedAtPoint()`.
- Seeding modes include 'set', 'clear', 'toggle', and 'random'. `seedPattern` options include builtin ASCII patterns, 'Custom ASCII', and 'Random Disk' (a generated circular seed scaled by `seedScale`).
- `LifeSphereSim.pointToCell()` — mapping a 3D point (impact point) to grid cell coordinates.

## Best practices

- Keep `LifeSphereSim` pure and deterministic; test `step()` and `pointToCell()` thoroughly.
- Maintain row flipping in `PlanetLife.updateTexture()` to avoid relying on `flipY` semantics across different Three.js versions.
- Maintain row flipping in `writeLifeTexture()` (moved out of `PlanetLife.tsx`) to avoid relying on `flipY` semantics across different Three.js versions.
- Use `instancedMesh.count` rather than allocating smaller meshes for each alive cell.
- Keep `specs/current-state.md` and the Memory Bank (`memory/`) in sync when changing behavior or architecture.
- **Environment shaders**: Keep shader uniforms updated via `useFrame`; use `BackSide` for skybox spheres.

## Edge cases & defensive behavior

- `LifeSphereSim` clamps values for lat/lon and grid sizes to prevent RangeError.
- UI controls may emit NaN/undefined transiently — use defaults and safe guards to prevent crashes.

## Notes for future refactors

- Adding a multi-planet mode or persisting grid state would require a small orchestration layer (store + export/import format).
- If grid size is made very large, consider chunking updates, WebGL compute shaders, or offloading to Web Workers.
- Environment components are self-contained; they could be extracted into a shared package if needed for other projects.
