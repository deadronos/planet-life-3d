## 2025-02-20 - Loop Unrolling and Modulo Avoidance in Grid Simulation
**Learning:** In a 2D grid simulation on a sphere (wrapped longitude), the neighbor calculation loop using modulo arithmetic for every neighbor access is a significant bottleneck. Splitting the loop into a "safe center" (no wrapping needed) and "edge cases" (wrapping needed) removes the modulo operations for the vast majority of cells.
**Action:** When optimizing grid-based simulations with boundary conditions, always look for opportunities to process the "inner" safe area separately from the edges to avoid conditional checks or expensive math (like modulo) in the hot loop.

## 2025-02-21 - Full Loop Peeling & Bitmask Rules
**Learning:** Even with "safe zone" logic, the per-iteration check `if (lo > 0 ...)` adds overhead. Fully unrolling the loop into distinct Left/Center/Right blocks removes this check completely. Additionally, converting boolean array rules to integer bitmasks eliminates array lookups and branching in the hot path.
**Action:** For high-performance grid loops in JS, prefer full loop peeling over in-loop conditionals, and use bitwise operations for state lookups where possible.

## 2025-02-21 - Sparse Iteration for Rendering
**Learning:** In a cellular automaton, rendering typically iterates the entire grid to draw alive cells. Maintaining a secondary list of `aliveIndices` during the simulation step (which already iterates the grid) allows the render loop to be O(Alive) instead of O(Total). This is a massive win (20x+) for sparse grids.
**Action:** When an expensive render loop iterates a large data structure to find a small subset of active items, maintain an active list/index during the state update phase.

## 2025-02-21 - Colony Mode Loop Peeling
**Learning:** The "Safe Center" optimization (splitting loop to avoid modulo) was missing from `stepColony`, leading to it being 2.4x slower than Classic mode. Applying the same loop peeling technique yielded a 2x speedup. Inlining the neighbor-check logic was required to fit the unrolled structure.
**Action:** Ensure optimization patterns (like loop peeling) are applied consistently across all variations of a hot path (e.g. different game modes).
