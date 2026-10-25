import { expect, type Page, test } from '@playwright/test';

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

    // Stats arrive asynchronously (GPU readback), so poll instead of reading once.
    // Reading immediately after the click raced the readback and saw the stale 0.
    await expect
      .poll(
        async () =>
          Number(
            await page
              .locator('.hud-stats .hud-row:has(.hud-label:has-text("Pop")) .hud-value')
              .first()
              .innerText(),
          ),
        { timeout: 5_000 },
      )
      .toBeGreaterThan(0);
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

const genLocator = (page: Page) =>
  page.locator('.hud-stats .hud-row:has(.hud-label:has-text("Gen")) .hud-value').first();

test.describe('render smoke', () => {
  test('boots without console errors and renders non-black pixels', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('canvas')).toBeVisible();
    // Let a few frames render before sampling the screen.
    await page.waitForTimeout(1_000);

    // Screenshot the canvas element: reading the WebGL buffer directly is
    // unreliable without preserveDrawingBuffer.
    const shot = await page.locator('canvas').screenshot();
    const lit = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      if (!ctx) return 0;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 16) {
        if (d[i] + d[i + 1] + d[i + 2] > 30) n++;
      }
      return n;
    }, shot.toString('base64'));
    expect(lit).toBeGreaterThan(100);
    expect(errors).toEqual([]);
  });

  test('Step advances Gen while paused', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const pause = page.getByRole('button', { name: 'Pause simulation' });
    await pause.click();
    await expect(page.getByRole('button', { name: 'Play simulation' })).toBeVisible();
    // Wait for any in-flight tick to settle, then record Gen.
    await page.waitForTimeout(500);
    const before = Number(await genLocator(page).innerText());
    await page.getByRole('button', { name: 'Step one generation' }).click();
    await expect
      .poll(async () => Number(await genLocator(page).innerText()), { timeout: 5_000 })
      .toBeGreaterThan(before);
  });

  // Inherently timing-dependent: the meteor has to travel to the planet
  // before the probe card appears, so allow a generous poll window.
  test('firing the Probe tool at the planet fills the probe card', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Probe' }).click();
    await expect(page.getByRole('region', { name: 'Impact probe' })).toHaveCount(0);
    const box = await page.locator('canvas').boundingBox();
    if (!box) throw new Error('canvas has no bounding box');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByRole('region', { name: 'Impact probe' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('phone width: HUD, transport and toolbelt do not overlap', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const selectors = ['.hud-stats', '.transport-bar', '.meteor-toolbelt'];
    const rects: { sel: string; x: number; y: number; w: number; h: number }[] = [];
    for (const sel of selectors) {
      const el = page.locator(sel).first();
      await expect(el).toBeVisible();
      const b = await el.boundingBox();
      if (!b) throw new Error(`${sel} has no bounding box`);
      expect(b.x).toBeGreaterThanOrEqual(-1);
      expect(b.x + b.width).toBeLessThanOrEqual(376);
      rects.push({ sel, x: b.x, y: b.y, w: b.width, h: b.height });
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.sel} overlaps ${b.sel}`).toBe(false);
      }
    }
  });
});
