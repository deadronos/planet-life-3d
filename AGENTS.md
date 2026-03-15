# AGENTS.md — planet-life-3d

Single-page React + TypeScript (Vite) app that renders a 3D spherical cellular‑automata simulation using three.js and @react-three/fiber.

**Package manager:** npm

## Read first (repo-wide rules)

Read `.github/copilot-instructions.md` and `.github/instructions/` before making changes.

## After finishing code changes

Run: `npm run test && npm run lint && npm run typecheck`

## Commands (the non-standard bits)

- Dev: `npm run dev`
- Tests: `npm run test`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck` (fast: runs `tsc -b --noEmit`)
- Production build: `npm run build` (runs `tsc -b` then `vite build`)

## More detailed guidance (progressive disclosure)

- [Project overview & key files](docs/agents/overview.md)
- [Where to change what](docs/agents/where-to-change-what.md)
- [Simulation & rendering invariants](docs/agents/simulation-invariants.md)
- [Testing (Vitest + Playwright)](docs/agents/testing.md)
- [TypeScript notes (Vitest mocks, Leva typing)](docs/agents/typescript.md)
- [Troubleshooting & debugging tips](docs/agents/troubleshooting.md)
- [Deployment notes](docs/agents/deployment.md)
