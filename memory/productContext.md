# Product Context — Planet Life 3D

**Goal**
Provide a small, approachable interactive simulation that is both educational and visually appealing. Users should be able to understand how simple local rules produce complex global behavior and explore the dynamics by changing rules and seed patterns.

**User personas**
- Students / Learners: Learn about cellular automata and emergent behavior.
- Developers: Explore Three.js and WebGL patterns using a small, optimised codebase.
- Creators / Artists: Use as a generative art base for visuals.

**User stories**
- WHEN a user starts the application, THEY CAN orbit the planet and see the grid overlay.
- WHEN a user changes the birth or survival digits, THE SYSTEM shall apply new rules without reloading the page.
- WHEN a user clicks the planet, THE SYSTEM shall fire a meteor and seed cells at the impact.
- WHEN the user selects ‘Custom ASCII’ patterns, THE SYSTEM shall parse and apply the ASCII pattern when seeding.

**Acceptance criteria**
- Interactive controls via Leva—users can tune grid, rules, speed, meteors and seeding.
- Visual overlay (DataTexture) and instanced dots show the current simulation state in real-time.

**Constraints**
- Expect cross-browser variability on older devices; optimize for modern browsers.
- UI may temporarily produce invalid values; simulation should prevent crashes (defensive guards present).

