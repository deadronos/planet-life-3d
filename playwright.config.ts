import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the e2e tests under `tests/e2e/`.
 *
 * The dev server is started automatically before the suite runs. We point
 * at `npm run dev` (port 5173) by default. Override with `PLAYWRIGHT_BASE_URL`
 * or `npm run dev -- --port=...` for local experimentation.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.(spec|e2e)\.(ts|tsx)$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
