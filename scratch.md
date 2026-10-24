# Next issues — suggested order (2026-10-24)

Umbrellas: UX #150 · Visual #151 · Perf #152 · Code #153. In flight: #136 → PR #154.

## 1. #148 Group `PlanetLifeControls` into slices (code)

Unblocks #146 and shrinks the long dependency arrays everywhere. Mechanical, low risk,
good for a cheap model. Do it before more features land on the 70-field type.

## 2. #146 Extract seeding/tool dispatch from `PlanetLife.tsx` (code)

Removes the duplicated GPU seeding path and the 16-dep `useMemo`. Pure-function core =
easy tests. Also a good moment to revisit the `simCommand` bus added in #154.

## 3. #143 Split the 1.45 MB JS bundle (perf)

Biggest load-time win, independent of everything else. Measure before/after; add a size budget.

## 4. #137 On-screen transport controls + slim Leva (UX)

Biggest first-impression UX gain. Builds directly on #154 (same store commands), so do it
after that merges. Easier after #148 (Basics vs Advanced maps to slices).

## 5. #139 WebGL context loss / error boundary (UX/robustness)

Black screen today on context loss. Small, self-contained.

## Then (cheap fillers, any order)

- #144 self-host font — tiny, pairs with #143
- #145 render on demand when idle — battery win
- #140 mobile/a11y polish
- #149 repo hygiene

## Later / larger

- #147 split `GPUSimulation.tsx` → then #93 render tests get easier
- #135 bloom → then #142 night-side glow
- #124 baked surface noise
- #141 sparkline, #138 shareable URLs (needs seeded RNG)

## Parallelism

Safe to run side by side: #143 + #144 (build/css) ∥ #148→#146 (components) ∥ #139.
Avoid running #137 and #148 together — both touch `controls.ts`.
