# Testing

## Unit tests (Vitest)

- Unit tests live under `tests/`.
- Run once: `npm run test`
- Watch: `npm run test:watch`
- UI: `npm run test:ui`

Good unit-test targets:

- `src/sim/LifeSphereSim.ts` (pure logic)
- `src/sim/spherePointToCell.ts`
- `src/sim/patterns.ts` (`parseAsciiPattern`)

## E2E tests (Playwright)

- E2E tests should live under `tests/e2e` and use `@playwright/test`.
- Use E2E primarily for real-browser interaction flows (canvas + controls).
