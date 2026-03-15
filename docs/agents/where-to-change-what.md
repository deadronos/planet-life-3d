# Where to change what

## Simulation rules

- Rule parsing (UI digits): `src/sim/rules.ts` (`parseRuleDigits`)
- Applying rules to simulation: `src/sim/LifeSphereSim.ts` / `src/sim/LifeSimBase.ts`

## Built-in patterns

- Add/edit patterns in `src/sim/patterns.ts` (`BUILTIN_ASCII`, `parseAsciiPattern`, `getBuiltinPatternOffsets`).

## Rendering modes

- Texture/overlay path: `src/components/PlanetLife.tsx` and shader code in `src/shaders/`.
- Dots/instanced mesh path: `src/components/PlanetLife.tsx` (instanced mesh allocation + updates).

If you change cell indexing/layout, make sure both the texture write path and the instanced mesh path remain consistent.

## Seeding (meteor impacts / pointer)

- World point → cell mapping: `src/sim/spherePointToCell.ts` (called by `LifeSphereSim.pointToCell()`)
- CPU seeding: `LifeSphereSim.seedAtPoint()` / `seedAtCell()`
- UI integration: `src/components/PlanetLife.tsx` (seed controls) and `src/components/planetLife/useSimulationSeeder.ts`
