import { expect, test } from '@playwright/test';

/**
 * Real-browser smoke tests. These run against `npm run dev` and verify
 * that the bundle boots, the canvas + Leva panel render, and the basic
 * Action buttons (Clear / Randomize) update the HUD stats.
 *
 * They run with the WebGL renderer (real GPU), so the canvas is not
 * just a jsdom stub. They're slower than unit tests, so keep them small.
 */
test.describe('app smoke', () => {
  test('boot: canvas + overlay + Leva render', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Title overlay (sanity).
    await expect(page.getByText('Planet Life 3D')).toBeVisible();
    // WebGL canvas present (real GPU, not the jsdom stub used in unit tests).
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    // Confirm the canvas was actually created with a WebGL context.
    const engine = await canvas.getAttribute('data-engine');
    expect(engine).toMatch(/three\.js/);
  });

  test('Clear action: HUD population goes to 0', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for the sim to start (HUD Gen ticks up after a few frames).
    const popBefore = await page
      .locator('.hud-stats .hud-row:has(.hud-label:has-text("Pop")) .hud-value')
      .innerText();
    expect(popBefore).toMatch(/\d+/);

    // The Leva Actions folder is a top-level Leva folder whose button
    // row can be overlapped by Leva's own drag handle. We dispatch the
    // click via the DOM rather than going through Playwright's pointer
    // pipeline, which can be intercepted by that drag handle.
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Clear',
      );
      if (!btn) throw new Error('Clear button not found in DOM');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // After Clear, pop should be 0.
    await expect(
      page.locator('.hud-stats .hud-row:has(.hud-label:has-text("Pop")) .hud-value').first(),
    ).toHaveText('0', { timeout: 5_000 });
  });

  test('Randomize action: HUD population becomes non-zero again', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Clear first so we have a known starting point.
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Clear',
      );
      if (!btn) throw new Error('Clear button not found in DOM');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await expect(
      page.locator('.hud-stats .hud-row:has(.hud-label:has-text("Pop")) .hud-value').first(),
    ).toHaveText('0', { timeout: 5_000 });

    // Then randomize.
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Randomize',
      );
      if (!btn) throw new Error('Randomize button not found in DOM');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // After randomize at default density (0.14) on a 100x160 grid, pop
    // should be in the hundreds, not zero.
    const pop = await page
      .locator('.hud-stats .hud-row:has(.hud-label:has-text("Pop")) .hud-value')
      .first()
      .innerText();
    const n = Number(pop);
    expect(n).toBeGreaterThan(0);
  });

  test('toolbelt tool selection updates the active button', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // The Sterilizer button should not be pressed by default.
    const sterilizer = page.getByRole('button', { name: 'Sterilizer' });
    await expect(sterilizer).toHaveAttribute('aria-pressed', 'false');

    // Click it and confirm it becomes the active tool.
    await sterilizer.click();
    await expect(sterilizer).toHaveAttribute('aria-pressed', 'true');
  });
});
