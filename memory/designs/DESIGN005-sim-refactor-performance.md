# DESIGN005 — Simulation Refactor & Performance

**Goal**

- Reduce duplication in `LifeSphereSim`, standardize constants, and apply low-risk performance improvements to hot paths in sim and rendering.

**Context & Constraints**

- Simulation must remain deterministic and pure; `LifeSphereSim` remains a pure TS class that uses typed arrays (`Uint8Array`) for grid/state.
- Avoid introducing GC pressure or per-tick allocations; keep `positions`/`normals` precomputed.

**Design**

1. **Refactor & Constants**
   - Extract constants to `src/sim/constants.ts` with conservative bounds and defaults.
   - Consolidate repeated neighbor loop logic into helper loops for readability.

2. **Performance Improvements**
   - Skip expensive DataTexture updates when overlay is hidden (i.e., `cellRenderMode === 'Dots'`).
   - Use `DynamicDrawUsage` for instanced buffers and reuse `THREE.Color` scratch objects to avoid per-frame new allocations.
   - Reduce allocations in `Meteor` by reusing geometry and buffers for trails.

**Validation**

- Unit tests ensure `step()` output unchanged after refactor.
- Manual testing with large grid sizes shows reduced CPU usage and smoother frames.

**Open Questions**

- Add micro-benchmarks or CI perf checks if we need to guard regressions in future.
