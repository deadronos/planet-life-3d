# Project overview & key files

## What this project is

- Single-page React + TypeScript app using Vite + three.js + @react-three/fiber.
- A lat/lon grid (Conway-like) mapped to a sphere; simulation is computed in `src/sim/` and rendered in `src/components/`.

## Quick setup

- Recommended: Node.js v18+ (LTS) or newer
- Install: `npm install`
- Dev server: `npm run dev` (Vite default port is 5173)
- Production build: `npm run build`
- Preview: `npm run preview`

## Where to start (key files)

- Simulation core: `src/sim/LifeSphereSim.ts` — grid arrays and sphere mapping helpers; good candidate for unit tests.
- Patterns: `src/sim/patterns.ts` — ASCII patterns via `parseAsciiPattern()` and built-ins.
- Rendering/UI integration: `src/components/PlanetLife.tsx` — UI knobs (Leva), texture + overlay + instanced mesh paths.
- Interactions: `src/components/Meteor.tsx`, `src/components/ImpactRing.tsx`.
- App entry: `src/App.tsx`, `src/main.tsx`, `vite.config.ts`.
