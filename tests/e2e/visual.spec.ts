import { expect, test } from '@playwright/test';

test.describe('visual verification of simulation', () => {
  test('captures baseline, cleared, and randomized states', async ({ page }) => {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    await expect(page.getByText('PLANET LIFE 3D')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    await page.screenshot({ path: 'verification/initial.png' });

    const clearButton = page.locator('button:has-text("Clear")');
    await expect(clearButton).toBeVisible();
    await clearButton.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'verification/after_clear.png' });

    const randomizeButton = page.locator('button:has-text("Randomize")');
    await expect(randomizeButton).toBeVisible();
    await randomizeButton.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'verification/after_randomize.png' });
  });
});
