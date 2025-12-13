# AGENTS.md — planet-life-3d

Short, actionable instructions for AI coding agents working on this repo.

Important: Read the `.github/copilot-instructions.md` and `.github/instructions/` files first — they contain workspace-level instructions, safety rules, and file-type guidance.

What this project is

- A single-page React + TypeScript app using Vite + three.js + @react-three/fiber.
- A lat/lon grid (Conway-like) mapped to a sphere; simulation steps are computed in `src/sim/LifeSphereSim.ts` and rendered by `src/components/PlanetLife.tsx`.

Quick setup (first commands)

```bash
# Recommended: Node.js v18+ (LTS) or newer
npm install
npm run dev   # start Vite dev server on port 5173
npm run build # type-check (tsc -b) then Vite production build
npm run preview # preview production build
```

Where to start (key files)

- Simulation core: `src/sim/LifeSphereSim.ts` — grid arrays, `step()`, `seedAtPoint/seedAtCell()` (pure TS, ideal unit tests).
- Patterns: `src/sim/patterns.ts` — ASCII patterns, `parseAsciiPattern`, and built-ins.
- Rendering / UI: `src/components/PlanetLife.tsx` — `lifeTex` DataTexture, `updateTexture()`, instanced mesh logic, knobs via `leva` `useControls()`.
- Interactions: `src/components/Meteor.tsx` and `src/components/ImpactRing.tsx`.
- App start: `src/App.tsx`, `src/main.tsx`, `vite.config.ts`.

Important conventions & invariants

- Use `Uint8Array` for hot grid buffers and keep precomputed `positions` / `normals` arrays for rendering as in `LifeSphereSim`.
- Defensive guards: `safeInt`, `safeFloat` & input clamping are used throughout. Don’t remove them — Leva UI can produce transient invalid values during editing.
- DataTexture row flip: `PlanetLife.updateTexture()` intentionally flips rows when writing the DataTexture — preserve this mapping when changing grid indexing or texture code.
- Mesh sizing: `maxInstances = latCells * lonCells` controls the instanced mesh. Avoid changing instance sizing without updating `cellsRef` allocation.
- Wrap-around longitude: `LifeSphereSim` uses modulo on lon; lat is clamped (no wrap at poles).

Where to modify logic safely

- Simulation rules: `parseRuleDigits` (parsing UI inputs) and `LifeSphereSim.setRules`.
- Built-in patterns: `src/sim/patterns.ts` (add ASCII entries to `BUILTIN_ASCII`, use `parseAsciiPattern`).
- Rendering modes: `Texture` uses the equirectangular `DataTexture`, `Dots` uses an instanced mesh. If you change one, update the other for parity.
- Seeding: `PlanetLife.seedAtPoint()` calls `sim.seedAtPoint()` which uses `pointToCell()` for mapping world points to lat/lon.

Testing & validation

- The repo now uses Vitest for automated testing. Tests live under the `tests/` folder, and cover pure logic such as `LifeSphereSim.step()`, `LifeSphereSim.pointToCell()`, and `parseAsciiPattern()`.
- E2E (browser) tests should live under `tests/e2e` and use `@playwright/test` (Playwright) for real-browser testing of canvas and UI flows.
- Run the test suite: `npm run test`. Run in watch mode with `npm run test:watch` or open the Vitest UI with `npm run test:ui`.
- For TypeScript verification, `npm run build` still runs the authoritative type-check (`tsc -b`).

Common build issues

- `leva` typing: If `tsc` reports errors like `Property 'running' does not exist on type 'FunctionReturnType<...>'`, it's caused by `leva`'s complex return typings. Quick fixes:
  - Cast the `useControls` result when destructuring: `const params = useControls(() => {...}) as any` or `const p = params as any` then destructure `p`.
  - Alternatively, install compatible `leva` types or adjust the TS version. Use `npm run build` to validate after changes.

Performance & debugging tips

- Keep grid sizes modest when experimenting (latCells x lonCells increases CPU and memory usage). Reduce `tickMs` to speed up iterations but be mindful of the main thread.
- For performance-sensitive changes, prefer `Uint8Array` and precompute `positions/normals` like `LifeSphereSim` — avoid heap allocations in hot loops.
- To debug rendering glitches: check `lifeTex.data` contents, the row flip, and that `instanceMatrix.needsUpdate` is set after updates.

PR Checklist for agents

- Run `npm run build` and verify `tsc` does not emit type errors.
- Run `npm run dev` and visually verify the change in the browser.
- If you touch rendering or simulation invariants, update `.github/copilot-instructions.md` and this `AGENTS.md` with the changed behavior.
- Add tests for pure logic (`LifeSphereSim`, `parseAsciiPattern`).
- Update README or add docs if there are behavioral or UX changes.

Other resources

- `.github/copilot-instructions.md` (workspace agent guidance)
- `.github/instructions/` (project-specific coding rules and test guidelines)
- `README.md` for binary start instructions and UX notes

If you are a non-human agent: follow workspace instruction files first, then this `AGENTS.md`, to make automated changes. If anything is unclear, open a PR with a small change and a short explanation to get human feedback.

Deployment note: a new tag push starting with `v` (for example, `v1.2.3`) triggers the workflow `.github/workflows/deploy-pages.yml` to build and deploy the `dist` site to GitHub Pages.
