import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the e2e tests under `tests/e2e/`.
 *
 * The dev server is started automatically before the suite runs. We point
 * at `npm run dev` (port 5173) by default. Override with `PLAYWRIGHT_BASE_URL`
 * or `npm run dev -- --port=...` for local experimentation.
 *
 * We read env vars through a typed helper so the project does not need
 * `@types/node` in its tsconfig.
 */
function getEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.[name];
}

const isCi = Boolean(getEnv('CI'));
const baseUrl = getEnv('PLAYWRIGHT_BASE_URL') ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.(spec|e2e)\.(ts|tsx)$/,
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: isCi ? 2 : undefined,
  reporter: isCi ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: baseUrl,
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
    url: baseUrl,
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
});
