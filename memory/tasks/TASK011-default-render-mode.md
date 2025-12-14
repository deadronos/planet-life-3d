# [TASK011] - Document Default Render Mode Change (Switch to `Both`) and Texture Stats Logging

**Status:** Completed  
**Added:** 2025-12-13  
**Updated:** 2025-12-14

## Original Request

Make the default render mode more expressive and helpful for exploration by setting it to `Both` (Texture overlay + Dots) and add optional texture stats logging for diagnostics.

## Thought Process

- `Both` is the best default for quick visual feedback; keep an option to switch to `Texture` or `Dots` for performance testing.
- Add internal texture stats logging to help diagnose DataTexture uploads and memory usage during development.

## Implementation Summary

- Switched default control to `Both` and added texture stats logging hooks accessible in debug mode.
- Commit: `302d636` (2025-12-13) — "feat: switch default render mode to Both and add texture stats logging".

## Files changed

- `src/components/planetLife/controls.ts`
- `src/components/planetLife/lifeTexture.ts` (added small logging helpers)

## Validation

- Manual check in dev server to ensure default mode is `Both` and overlay+dots render together.
- No breaking changes to API.

## Notes

- This change has minor perf implications for very large grids but is balanced by the improved UX for first-time users.
