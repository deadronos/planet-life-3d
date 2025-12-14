# [TASK011] - Default Render Mode Proposal (Switch to `Both`)

**Status:** Abandoned / Not Applied  
**Added:** 2025-12-13  
**Updated:** 2025-12-14

## Original Request

Propose changing the default render mode to `Both` (Texture overlay + Dots) to provide immediate visual feedback to users, and add optional texture stats logging for diagnostics.

## What happened

- A change was proposed (commit `302d636`) that set `cellRenderMode` to `Both` in an early implementation of `PlanetLife.tsx`.
- The consolidated controls in `src/components/planetLife/controls.ts` currently set the default `cellRenderMode` to `Texture`. The runtime default therefore remains `Texture` and the proposed switch to `Both` was not adopted.

## Implementation Notes

- If the team wants to pursue this change, the correct place to update the default is `usePlanetLifeControls()` in `src/components/planetLife/controls.ts` (change `cellRenderMode.value` to `'Both'`) and validate behavior across the overlay and instanced `Dots`.
- Consider performance implications for large grids and provide an opt-in debug logging flag for texture stats rather than enabling it by default.

## Next steps / Acceptance criteria if re-opened

- Update `usePlanetLifeControls()` default to `'Both'` and add an automated test or smoke check to ensure the overlay+dots both render on startup.
- Add a small performance note and optional debug-only texture stats logging behind `debugLogs`.
- Validate with `npm run test` and manual visual checks.

## Current status

- The default remains `Texture` in code; this task is closed as "Abandoned / Not Applied" until the team explicitly approves the UX change.
