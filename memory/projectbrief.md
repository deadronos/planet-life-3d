# Project Brief — Planet Life 3D

**Short description**
A single-page React app that runs a Conway-style cellular automaton mapped onto a sphere. The application renders a lat/lon grid on a 3D planet using Three.js and @react-three/fiber. Users can interact with the planet (orbit, zoom, click to fire meteors), configure simulation rules and parameters via Leva controls, and observe the results rendered as a DataTexture or instanced meshes.

**Why this project exists**

- Educational demo of cellular automata on a non-flat surface (sphere).
- A small interactive art/visualization playground for procedural systems.
- A vector for learning performant WebGL rendering with Three.js and React.

**Scope & Goals**

- Implement a deterministic, performant cellular automaton that runs on a lat/lon grid.
- Keep the simulation pure and testable in TypeScript (`src/sim/LifeSphereSim.ts`).
- Provide two visual modes: `Texture` overlay (DataTexture) and `Dots` (instanced mesh).
- Support interactive seeding via built-in patterns, custom ASCII patterns, and meteor-based impacts.
- Expose simulation controls and configuration via Leva UI.

**Core files and components**

- Simulation core: [src/sim/LifeSphereSim.ts](src/sim/LifeSphereSim.ts#L1) and [src/sim/patterns.ts](src/sim/patterns.ts#L1)
- UI & rendering: [src/components/PlanetLife.tsx](src/components/PlanetLife.tsx#L1)
- Visual interactions: [src/components/Meteor.tsx](src/components/Meteor.tsx#L1), [src/components/ImpactRing.tsx](src/components/ImpactRing.tsx#L1)
- Project entrypoint: [src/main.tsx](src/main.tsx#L1) and [src/App.tsx](src/App.tsx#L1)

**Acceptance Criteria (EARS style)**

- WHEN the user opens the app, THE SYSTEM SHALL display a planet with a grid overlay and controls to change simulation parameters. [manual acceptance: app loads, sphere and Leva controls visible]
- WHEN the user clicks the planet, THE SYSTEM SHALL spawn a meteor that seeds the grid on impact using a selected pattern. [manual acceptance: meteor fires, impact ring appears, cells seeded]
- WHEN simulation rules or grid size change, THE SYSTEM SHALL run the sim tick using the updated parameters and update the rendering accordingly (texture +/or dots). [manual acceptance: rules update without requiring reload, grid updated]
- WHEN seed pattern is changed to Custom ASCII, THE SYSTEM SHALL parse the ASCII and apply the pattern when seeding. [unit test possible: parseAsciiPattern]

**Non-goals**

- This project is not a full simulation research framework — it’s a gameplay/visualization demo.
- No server-side persistence or multiplayer features planned.

**Success Metrics**

- Stable frame rate for common grid sizes (e.g., 48x96) on modern desktop.
- Low-latency UI and predictable interactions.
- Well-tested simulation logic (unit tests for `LifeSphereSim`, `parseAsciiPattern`, and `pointToCell`).

**Related memory files**

- See memory/productContext.md for user personas and scenarios
- See memory/techContext.md for stack and developer commands
