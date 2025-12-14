# [TASK006] - Add rule presets and color themes

**Status:** Completed  
**Added:** 2025-12-14  
**Updated:** 2025-12-14

## Original Request

Add user-facing rule presets (e.g., Conway, HighLife, Day & Night) and designer color themes that set cell/atmosphere/heat/impact palette values. Expand the set of builtin seed patterns.

## Thought Process

- UX: Users often want quick presets for familiar cellular automata rules; adding a `Rule Preset` control that writes to `birthDigits`/`surviveDigits` simplifies exploration.
- Visuals: Color themes provide an easy way to change the look-and-feel (e.g., Mars, Matrix) and to ensure consistent palette variables are used across materials and impacts.
- Implementation: Expose presets and themes in the `leva` controls (`usePlanetLifeControls`) and centralize definitions in `src/sim/presets.ts` for reusability and testability.

## Implementation Plan

- Add `src/sim/presets.ts` exporting `RULE_PRESETS` and `COLOR_THEMES` with name arrays.
- Update `usePlanetLifeControls()` to include `rulePreset` and `theme` controls which set `birthDigits`, `surviveDigits`, and visual colors when selected (skip when 'Custom').
- Expand `src/sim/patterns.ts` builtin ASCII patterns list with a few well-known patterns (Acorn, LWSS, Diehard, etc.).
- Add/update component tests to assert the expected control defaults and rendering behavior.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                                   | Status    | Updated    | Notes                                   |
| --- | --------------------------------------------- | --------- | ---------- | --------------------------------------- |
| 6.1 | Add `src/sim/presets.ts`                      | Completed | 2025-12-14 | Contains `RULE_PRESETS`, `COLOR_THEMES` |
| 6.2 | Wire presets/themes into `controls.ts`        | Completed | 2025-12-14 | Added `rulePreset` and `theme` controls |
| 6.3 | Expand builtin patterns in `patterns.ts`      | Completed | 2025-12-14 | Added `Acorn`, `Diehard`, `LWSS`, etc.  |
| 6.4 | Update tests to reflect new defaults/controls | Completed | 2025-12-14 | Updated `PlanetLife.test.tsx`           |

## Progress Log

### 2025-12-14

- Implemented `src/sim/presets.ts` (Rule presets + Color themes). (commit: 3e6eea3)
- Updated `usePlanetLifeControls()` to add `rulePreset` and `theme` selectors and wiring to write `birthDigits`/`surviveDigits` and palette values.
- Expanded builtin ASCII patterns in `src/sim/patterns.ts`.
- Updated `tests/component/PlanetLife.test.tsx` to reflect default render mode and ensure no DOM errors in test harness.
- Fixed type-safety / `useEffect` for `setRef` in `usePlanetLifeControls()` to avoid transient value issues. (commit: 11614fe)

**Notes:** This change is self-contained and adds no breaking API changes. Follow-up: consider adding a small UI hint for 'Custom' presets and persist user-selected theme in local storage.
