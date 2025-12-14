# [TASK004] - Visual Upgrades (Atmosphere, Cell Palette, Meteor VFX)

**Status:** Completed
**Added:** 2026-02-14
**Updated:** 2026-02-14

## Original Request

Implement the high-impact visual upgrades (rim/terminator glow, secondary cell color channel, meteor streak/flash) and surface them in a new Leva folder, based on the dev branch.

## Thought Process

- Depth cues need an atmosphere shell plus stronger day/night falloff.
- Color expressiveness can come from age fade or neighbor heat; requires metadata from the sim.
- Meteor moments benefit from a streak while in flight and a flash + ring at impact; controls should live together.

## Implementation Plan

1. Extend `LifeSphereSim` with age and neighbor heat arrays that swap with the grid; add getters and keep seeding/randomize in sync.
2. Build an `Upgrades` Leva folder in `PlanetLife.tsx` covering atmosphere/rim/terminator, cell color mode (solid/age/heat), and meteor VFX styling.
3. Update planet rendering to use shader-driven lighting plus an atmosphere shell that responds to controls.
4. Update texture + instanced mesh colors to use the selected cell color mode (including per-instance colors).
5. Enhance meteor and impact visuals (trail + flash + tunable ring) and wire them to the controls.
6. Validate with `npm run build` and manual sim + meteor interactions.

## Progress Log

- 2026-02-14: Recorded design (DESIGN002) and requirements; implementation pending.
- 2026-02-14: Implemented atmosphere/rim shader, cell color modes, meteor streak + flash, and wired Leva controls; verified wit
  h `npm run build`.

## Notes

- Keep per-frame work allocation-free; reuse colors and typed arrays when deriving palettes.
- Ensure new metadata arrays stay bounded (Uint8) and swap alongside the grid to match render data.
