# Troubleshooting & debugging

## Rendering glitches

If visuals look “shifted” or rotated relative to the sim data, check:

- The texture write mapping (including any row flips)
- That the texture is marked `needsUpdate = true` after writes
- That instanced mesh updates set `instanceMatrix.needsUpdate = true` (when applicable)

## Performance debugging

- Keep grid sizes modest when iterating locally (latCells × lonCells scales quickly).
- Avoid heap allocations in hot loops.

## Build issues

- Use `npm run build` to catch TypeScript issues via `tsc -b`.
