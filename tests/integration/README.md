# Integration tests (tests/integration)

Purpose:

- Integration tests go here. These tests exercise flows across multiple components and validate multi-module interactions without needing full browser automation.
- End-to-end (E2E) browser-based tests should be placed in `tests/e2e` — see that folder's README for guidance and examples.

Guidelines:

- Use Vitest for integration tests in `tests/integration`. These tests run in a `jsdom` environment and are useful for verifying integration between components and modules.
- For browser-level E2E tests that interact with the UI and canvas, prefer Playwright (`@playwright/test`) and place those tests in `tests/e2e`.
- Start a local dev server with `npm run dev` (port 5173 referenced) or use `vite preview` for a production-like run when running browser tests locally.

Commands:

- Run integration tests (Vitest): `npm run test -- tests/integration`
- Run E2E (Playwright) tests: `npx playwright test` (see `tests/e2e/README.md` for setup and examples)

Notes:

- Integration tests are typically faster than e2e tests; reserve E2E for flow-level verification across the entire app.
- Consider adding a GitHub Actions job to run integration tests and a separate job for E2E tests in CI if needed.
