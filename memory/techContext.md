# Tech Context — Planet Life 3D

## Stack

- UI: React 19 + TypeScript
- Renderer: Three.js + @react-three/fiber (+ @react-three/drei)
- UI controls: Leva
- Build/tooling: Vite, TypeScript 5.x
- Dev tools: Node.js, npm

## Key dependencies (from package.json)

- react, react-dom
- three
- @react-three/fiber, @react-three/drei
- leva

## Developer commands

- Install: `npm install`
- Start dev server: `npm run dev` (Vite)
- Build (type-check + bundle): `npm run build` (runs `tsc -b` and `vite build`)
- Preview production bundle: `npm run preview`

## CI/Testing

- Vitest is used for tests; run `npm run test` locally and `npm run test:coverage` for coverage. Tests live in `tests/` with unit tests under `tests/unit` and component tests in `tests/component`.
- Recommendation: Add a GitHub Actions workflow to run `npm ci`, `npm run build`, and `npm run test` on push/PR to gate changes.
- TypeScript: `tsc -b` is run by `npm run build` and is the authoritative check for typing issues.

## Lint/formatting

- Lint: `npm run lint` (ESLint + Prettier)
- Auto-fix: `npm run lint:fix`

## Development notes

- Prefer `npm run dev` during active changes. Re-run full build when adding types or structural changes.
- If adding unit tests, use a Node-friendly test runner (Vitest or Jest) and add minimal test scaffolding.

## Lifecycle & Contribution

- PRs should include: short summary, changed files, validation steps (how to run locally + tests).
- Performance: Use the built-in `LifeSphereSim` typed design patterns for hot loops to keep UI responsive.
