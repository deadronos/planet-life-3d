import { test, expect } from '@playwright/test';

test('visual verification of simulation', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Wait for the planet to render
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'verification/initial.png' });

  // Use { force: true } to bypass pointer event interception
  const clearButton = page.locator('button:has-text("Clear")');
  await clearButton.click({ force: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'verification/after_clear.png' });

  const randomizeButton = page.locator('button:has-text("Randomize")');
  await randomizeButton.click({ force: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'verification/after_randomize.png' });
});
