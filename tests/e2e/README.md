# E2E / End-to-End tests (tests/e2e)

Purpose:

- Full end-to-end tests (browser automation) should be placed in `tests/e2e`.
- Use Playwright (`@playwright/test`) or another browser automation framework to test real user flows in a browser.

Guidelines:

- Playwright is recommended because it runs in real browsers (Chromium, Firefox, WebKit) and avoids the `jsdom` limitations when testing canvas or WebGL content.
- Name files `*.e2e.ts` or `*.spec.ts` and use Playwright's recommended test setup and runner (`npx playwright test`).
- Start a local dev server before running tests using `npm run dev` (or use `vite preview` for production-like tests).

Setup (Playwright):

1. Install Playwright (if not using the Playwright CLI):

```bash
npm i -D @playwright/test
npx playwright install
```

1. Optional: Add a `playwright.config.ts` at the repo root to customize timeouts, browsers, retries, and base URL.

Example (`tests/e2e/planet.e2e.ts`):

```ts
import { test, expect } from '@playwright/test';

test('shoot meteor on planet', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  // Click near the middle of canvas; adapt coordinates for your layout
  const canvas = await page.$('canvas');
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await page.click('canvas');
  }
  // Wait for visual change or a state change that indicates a meteor fired.
  await page.waitForTimeout(200);
  // Assertions: check DOM or app state changes (e.g., impact indicators present)
  await expect(page).toHaveURL(/./);
});
```

Commands:

- Run Playwright tests: `npx playwright test`
- Run with GUI (headed): `npx playwright test --headed`
- Debug a single test: `npx playwright test -g "shoot meteor on planet" --debug`

CI Considerations:

- Use the Playwright GitHub Action or run Playwright in CI by installing browsers (`npx playwright install --with-deps`) and running `npx playwright test` in the job after starting the dev server.
- Keep a small set of E2E tests for critical paths to avoid long pipelines. Run extended E2E suites nightly/for-release if necessary.

Notes:

- For canvas interactions, use `page.mouse` with coordinates or use `page.evaluate` to trigger custom events in the app if clicking isn't deterministic.
- Prefer descriptive test selectors (data-testid, data-test) to locate UI elements reliably.
