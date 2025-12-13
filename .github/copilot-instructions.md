# Copilot / AI Agent Instructions — planet-life-3d

Short, focused guidance for AI coding agents working on this repository.

## Big picture

- Single-page React app (Vite) that renders a 3D spherical cellular-automata simulation using three.js and @react-three/fiber.
- Simulation logic lives in `src/sim/` (pure TS): core is `LifeSphereSim.ts` (grid, tick, seeding, indexing).
- Rendering & UI live in `src/components/` and `src/App.tsx`: `PlanetLife.tsx` maps the sim to a DataTexture + instanced mesh; `Meteor.tsx` and `ImpactRing.tsx` provide interaction visuals.

## Key integration points (what to change where)

- Change simulation rules / neighbor parsing: `src/sim/parseRuleDigits` and `LifeSphereSim.setRules`.
- Add or edit builtin patterns: `src/sim/patterns.ts` (ASCII-based patterns returned by `getBuiltinPatternOffsets`).
- Modify rendering modes: update both the texture path in `PlanetLife.updateTexture()` and the instanced mesh logic in `PlanetLife` (both `Texture` and `Dots` modes must stay in sync).
- If you change the cell layout or indexing, update `LifeSphereSim.pointToCell()`, the `positions`/`normals` precompute in the sim, and the write loop in `PlanetLife` that fills the equirectangular `DataTexture`.

## Performance and safety patterns to preserve

- The sim uses typed arrays (`Uint8Array`) and precomputes `positions`/`normals` for performance — preserve this pattern for hot loops.
- Defensive guards (e.g., `safeInt`, `safeFloat`, clamping in constructors) exist because UI controls can briefly emit invalid values — do not remove those guards.
- Texture writes flip rows intentionally (see `updateTexture`) — preserve the row-flip mapping when changing texture logic.

## Developer workflows & commands

- Start dev server: `npm install` then `npm run dev` (Vite on port 5173 by default).
- Validate types+build: `npm run build` runs `tsc -b` then `vite build` (use this to catch TypeScript issues).
- Preview production build: `npm run preview`.

If `npm run dev` fails, ensure dependencies are installed and Node is supported; `tsc -b` is the authoritative type check.

## Project-specific conventions

- UI state uses `leva` via `useControls()` inside `PlanetLife.tsx` — add new knobs there when exposing parameters.
- Side-effect loops use React `useEffect` with explicit dependency lists and callbacks (avoid implicit globals).
- Keep heavy per-frame work inside `LifeSphereSim` or memoized callbacks; `useFrame()` (in other components) should be lightweight.

## Tests & validation

- There is no test harness in the repository. Use `npm run build` to validate TypeScript correctness and `npm run dev` to manually verify behavior in browser.
- Unit-test candidates: `LifeSphereSim.step()`, `pointToCell()` and `parseAsciiPattern()` are pure/isolated and ideal for adding tests.

## Quick code examples (where to look)

- Rendering loop / texture sync: [src/components/PlanetLife.tsx](src/components/PlanetLife.tsx)
- Simulation core: [src/sim/LifeSphereSim.ts](src/sim/LifeSphereSim.ts)
- Builtin patterns: [src/sim/patterns.ts](src/sim/patterns.ts)
- Rendering loop / texture sync: [src/components/PlanetLife.tsx](../src/components/PlanetLife.tsx)
- Simulation core: [src/sim/LifeSphereSim.ts](../src/sim/LifeSphereSim.ts)
- Builtin patterns: [src/sim/patterns.ts](../src/sim/patterns.ts)

## When proposing changes

- Reference the affected files above and run `npm run build` to catch type errors.
- Preserve defensive guards and typed-array usage. For rendering changes, demo both `Texture` and `Dots` modes.

---

If any area above is unclear or you'd like more examples (small patch templates or test skeletons), say which part and I will expand.
