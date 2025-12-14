# System Patterns & Architecture — Planet Life 3D

## Architecture overview

- A client-only React application (Vite) using TypeScript and Three.js.
- Rendering is built on `@react-three/fiber` — scene is React-managed but the simulation is contained in a pure TS class.
- `LifeSphereSim` is the single source of truth for the grid state; it is not a React component and is deliberately testable and pure.

## Key patterns

- Precompute geometry data (positions, normals) and keep it immutable — reduces GC pressure and per-frame allocation.
- Use typed arrays (Uint8Array) for grid state and texture data to make updates fast and memory efficient.
- Map the sim lat/lon grid to an equirectangular DataTexture (`THREE.DataTexture`) to exploit GPU speed for the overlay.
- Keep per-frame UI work minimal; all heavy loops and logic live in `LifeSphereSim`.
- Two rendering modes: `Texture` (DataTexture overlay) and `Dots` (instanced mesh), and they must stay in sync.
- Defensive guards (safeInt, safeFloat) to resist transient invalid inputs from UI controls.

## Integration points

- `LifeSphereSim.getGridView()` — read-only view used to populate the DataTexture.
- `LifeSphereSim.forEachAlive()` — optimized iterator used while setting instance matrices for alive cells.
- `LifeSphereSim.seedAtPoint()` / `seedAtCell()` — used by the UI and meteors to alter the grid.
- Seeding modes include 'set', 'clear', 'toggle', and 'random'. `seedPattern` options include builtin ASCII patterns, 'Custom ASCII', and 'Random Disk' (a generated circular seed scaled by `seedScale`).
- `LifeSphereSim.pointToCell()` — mapping a 3D point (impact point) to grid cell coordinates.

## Best practices

- Keep `LifeSphereSim` pure and deterministic; test `step()` and `pointToCell()` thoroughly.
- Maintain row flipping in `PlanetLife.updateTexture()` to avoid relying on `flipY` semantics across different Three.js versions.
- Use `instancedMesh.count` rather than allocating smaller meshes for each alive cell.
- Keep `specs/current-state.md` and the Memory Bank (`memory/`) in sync when changing behavior or architecture.

## Edge cases & defensive behavior

- `LifeSphereSim` clamps values for lat/lon and grid sizes to prevent RangeError.
- UI controls may emit NaN/undefined transiently — use defaults and safe guards to prevent crashes.

## Notes for future refactors

- Adding a multi-planet mode or persisting grid state would require a small orchestration layer (store + export/import format).
- If grid size is made very large, consider chunking updates, WebGL compute shaders, or offloading to Web Workers.
