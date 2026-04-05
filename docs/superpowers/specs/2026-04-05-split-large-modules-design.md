# Refactor: Split Large Modules

**Date:** 2026-04-05
**Status:** Approved

## Goal

Split 3 large files (1,391 lines total) into smaller, focused modules to improve maintainability, testability, and code clarity.

## Files to Refactor

### 1. `src/components/planetLife/usePlanetLifeSim.ts` (502 lines)

**Current:** Single hook managing simulation lifecycle, worker communication, tick loop, and instance updates.

**Split into:**

- `useSimWorker.ts` (~150 lines) - Worker lifecycle, message handling, buffer recycling
- `useSimTickLoop.ts` (~100 lines) - Tick scheduling, timing, main-thread vs worker dispatch
- `useSimInstances.ts` (~80 lines) - Instance matrix updates, color resolution
- `usePlanetLifeSim.ts` (~172 lines) - Facade composing above hooks + public API (clear, randomize, stepOnce, seedAtPoint)

**Interface unchanged:** Returns same `{ simRef, updateInstances, clear, randomize, stepOnce, seedAtPoint }`

### 2. `src/components/PlanetLife.tsx` (471 lines)

**Current:** Monolithic component handling planet, atmosphere, overlay, controls, meteors, GPU/CPU mode.

**Split into:**

- `PlanetMesh.tsx` (~50 lines) - Planet sphere geometry + material
- `Atmosphere.tsx` (~30 lines) - Atmosphere glow sphere
- `LifeOverlay.tsx` (~60 lines) - Life texture overlay mesh (Texture/Both modes)
- `CellsInstancedMesh.tsx` (~40 lines) - Instanced cell rendering (Dots mode)
- `MeteorEffects.tsx` (~50 lines) - Meteor + impact ring rendering
- `PlanetLife.tsx` (~241 lines) - Composition layer + useControls actions folder

**Interface unchanged:** Same props, same rendering output

### 3. `src/sim/LifeGridSim.ts` (418 lines)

**Current:** Single class with Classic and Colony step algorithms, seeding, stats.

**Split into:**

- `LifeGridSimBase.ts` (~200 lines) - Buffer management, seeding, stats, rebuildAliveIndices, getters
- `LifeGridSimClassic.ts` (~100 lines) - Classic step algorithm (sliding window optimization)
- `LifeGridSimColony.ts` (~100 lines) - Colony step algorithm (type-A counting)
- `LifeGridSim.ts` (~18 lines) - Re-exports Base class for backward compatibility

**Interface unchanged:** Same class/methods, just internal refactor

## Constraints

- Maintain all existing tests
- No changes to public API or behavior
- Keep related code together, separate unrelated code
- Follow existing patterns (hooks, file naming, exports)
