# [TASK008] - Document Overlay HUD, Onboarding Hint, and Hotkey

**Status:** Completed  
**Added:** 2025-12-13  
**Updated:** 2025-12-14

## Original Request

Add a lightweight overlay that shows runtime stats (generation, population, births/deaths), a one-time onboarding hint, and convenient UI hotkeys (e.g., `h` to toggle the Leva panel).

## Thought Process

- The overlay improves discoverability and reduces friction for new users; stats help with debugging and UX feedback during simulation runs.
- Keep onboarding unobtrusive and one-time: set a localStorage flag when shown so it doesn't reappear.
- Add a small hotkey `h` to toggle the Leva panel for quicker iteration.

## Implementation Summary

- Implemented `src/components/Overlay.tsx` that reads `useUIStore` for `stats` and shows a small HUD with `generation`, `population`, `birthsLastTick`, and `deathsLastTick`.
- Added onboarding hint logic using `localStorage` (key: `onboardingHintShown`) so it displays once and is covered by tests.
- Added hotkey handler for `h` to toggle the Leva UI panel (commit `5af79bb`, 2025-12-13).
- Implemented tests: `tests/component/Overlay.test.tsx` includes checks for onboarding hint behavior and localStorage usage.

## Files changed

- `src/components/Overlay.tsx`
- `src/styles.css` (HUD and onboarding styles)
- `tests/component/Overlay.test.tsx`
- `tests/components/App.test.tsx` (hotkey behavior tests)

## Commits

- `9b725c8` (2025-12-13) — "feat: implement HUD with zustand stats"
- `578bc76` (2025-12-13) — "feat: add one-time onboarding UI hint (#12)"
- `5af79bb` (2025-12-13) — "feat: add hotkey 'h' to toggle Leva UI panel"

## Validation

- Unit tests exist for store and overlay; run `npm run test` to validate.
- Manual: open app, confirm onboarding hint appears first visit and HUD updates as sim runs.

## Notes

- Consider persisting 'theme' or 'show HUD' user prefs in `localStorage` in a follow-up if requested.
