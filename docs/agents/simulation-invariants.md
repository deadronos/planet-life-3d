# Simulation & rendering invariants

These are easy to break accidentally; please preserve them unless you are intentionally changing behavior.

## Performance invariants

- Prefer typed arrays (`Uint8Array`) for hot grid buffers.
- Preserve precomputed `positions` / `normals` patterns in the sim for performance.

## Defensive input handling

- Keep `safeInt`, `safeFloat`, and clamping guards.
- Rationale: UI controls (Leva) can emit transient invalid values during editing.

## Indexing / mapping invariants

- Longitude wraps; latitude clamps (no wrap at the poles).
- Texture writes may intentionally flip rows; preserve the mapping if you modify texture generation.
- Instanced mesh sizing is tied to `maxInstances = latCells * lonCells`; keep allocation/updates aligned.
