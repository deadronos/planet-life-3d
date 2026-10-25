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

## Render integration tests (Vitest, `tests/integration`)

Unlike `tests/component` (which mocks `@react-three/fiber`), these mount the **real** R3F reconciler via `@react-three/test-renderer` and assert on the actual three.js scene graph:

- `gpuSimulation.render.test.tsx` – real `GPUSimulation` with all four `gpuSimulation/*` hooks wired together: step → ping-pong texture published → stats readback → HUD stats; clear resets generation; paused vs running frames.
- `planetLife.scene.test.tsx` – real `PlanetLife`: planet/atmosphere/overlay spheres, and click → meteor mesh added → frames → impact → probe set in the UI store.
- `meteor.smoke.test.tsx` – real `Meteor` impact/tunneling.

Pattern: `vi.doUnmock('@react-three/fiber')` (the global setup mocks it), then `vi.doMock` it again with the real module but `useThree().gl` replaced by `createFakeGl()` from `tests/unit/helpers/fakeGl.ts` (the test-renderer's own `gl` has no render-target API). Leva uses `tests/unit/helpers/levaMock.ts`. Run: `npm run test -- tests/integration`.

Not covered here: bloom gating is covered by `tests/unit/selectiveBloomLoader.test.ts` / `bloomSettings.test.ts`; real shader compilation needs a browser (see e2e).

## E2E smoke (Playwright)

`npm run test:e2e` starts `npm run dev` itself (or reuses a running server locally) and runs `tests/e2e/visual.spec.ts` in Chromium with real WebGL. First time: `npx playwright install chromium`. Run one test with `-g "<title>"`. Covered: boot with no console errors, canvas has non-black pixels, Step advances Gen while paused, Probe tool click fills the probe card, phone width (375px) HUD/transport/toolbelt don't overlap.

Notes:

- HUD stats arrive via async GPU readback; never read them once right after an action — use `expect.poll` / auto-retrying assertions (this was the cause of the old `Randomize` failure).
- The probe-card test depends on meteor flight time, so it uses a 15s timeout; it is the most timing-sensitive test.
- Canvas pixels are checked via an element screenshot, since the WebGL buffer is not preserved.
