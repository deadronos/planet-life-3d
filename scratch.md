# Next issues — suggested order (refreshed 2026-10-25)

Umbrellas: UX #150 · Visual #151 · Perf #152 · Code #153 · Hygiene #149 (this PR).
Done since last refresh: #148, #146, #143 (partial), #137, #139, #144, #145.

## Open

- #149 Repo hygiene: stray screenshots and planning docs (in flight)
- #147 Split `GPUSimulation.tsx` into focused hooks → then #93 render tests get easier
- #143 Reduce first-load JS: lazy-load Leva and defer non-critical code (finish remaining part)
- #142 Night-side glow for live cells (bioluminescence)
- #141 HUD: population history sparkline
- #138 Shareable worlds: encode preset, rules and seed in the URL (needs seeded RNG)
- #135 Add selective bloom for emissive elements → then #142
- #124 Bake planet surface noise instead of per-fragment simplex noise
- #93 Add render integration tests beyond heavy mocks

## Parallelism

- #147 and #143 touch different files; safe to run side by side.
- #135 and #142 both touch the render pipeline; keep them sequential.
