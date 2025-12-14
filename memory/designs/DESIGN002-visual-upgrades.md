# DESIGN002 — Visual Upgrades (Atmosphere, Cell Palette, Meteor VFX)

**Goal**

Elevate depth cues and storytelling by adding configurable atmosphere lighting, a second visual channel for cells, and a more dramatic meteor impact sequence.

**Context & Constraints**

- Rendering uses three.js via @react-three/fiber; UI knobs live in Leva folders inside `PlanetLife.tsx`.
- The simulation grid is a typed array in `LifeSphereSim`; rendering draws both a DataTexture and instanced mesh.
- Avoid heavy per-frame allocations; reuse buffers and prefer typed arrays.

**Requirements mapped**

- R5: Rim glow + stronger terminator, configurable in Leva.
- R6: Cell visualizer encodes age or neighbor stress without breaking sim updates.
- R7: Meteor streak + flash + ring with styling controls.

**Design**

1. **Atmosphere & Terminator**

- Add a custom shader-driven planet material that mixes day/night colors based on a fixed light direction and adjustable terminator sharpness/boost.
- Add an additive atmosphere shell scaled slightly above the planet radius with adjustable color/intensity.
- Expose knobs in a new `Upgrades` Leva folder: rim power/intensity, terminator sharpness/boost, atmosphere color/intensity/offset.

2. **Cell Visualizer Modes**

- Extend `LifeSphereSim` with per-cell `age` and `neighborHeat` typed arrays that track alive streaks and neighbor counts per tick (swap with grid state during step).
- Add a `cellColorMode` toggle in Leva (`Solid`, `Age Fade`, `Neighbor Heat`) and palette controls for heatmap colors plus an age falloff slider.
- Update `PlanetLife` rendering to derive DataTexture pixels and instanced mesh `instanceColor` from the selected mode, reusing a single `THREE.Color` scratch.

3. **Meteor VFX**

- Extend meteor specs to include trail length/thickness and emissive intensity; render a stretched tail aligned to motion plus brighter head glow.
- Extend impact specs with ring color/duration and flash size/intensity; render an additive flash sprite alongside the existing expanding ring.
- Surface controls in the `Upgrades` folder for trail, flash, and ring styling.

**Data Flow & Interfaces**

- `LifeSphereSim`: add `getAgeView()` and `getNeighborHeatView()` for renderers; update `step()`, `randomize()`, `seedAtCell()`, and `clear()` to keep metadata aligned with the grid.
- `PlanetLife`: new helper to map cell state -> color (uses mode + controls); apply to both DataTexture writes and instanced mesh `setColorAt`.
- `Meteor`/`ImpactRing`: accept richer spec objects with styling params sourced from Leva controls defined in `PlanetLife`.

**Validation Plan**

- Manual: Toggle `Upgrades` controls to verify rim/terminator changes, switch color modes while sim runs, fire meteors to observe streak + flash + ring.
- Automated: `npm run build` for type checks.

**Open Questions / Risks**

- Custom shader should remain lightweight; ensure compatibility with existing lighting and tone mapping.
- Instanced mesh colors require `vertexColors` to be enabled; ensure counts update correctly when color mode changes.
