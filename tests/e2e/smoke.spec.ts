import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('SafeCard public smoke and accessibility', () => {
  test('landing page is reachable without horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SafeCard/i);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test('benefit guide is keyboard operable and free of pilot wording', async ({ page }) => {
    await page.goto('/benefits');
    const first = page.getByRole('tab').first();
    await first.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.benefit-panel:not([hidden]) .benefit-persona span')).toBeVisible();
    await expect(page.getByText(/pilot|for validation|working baseline/i)).toHaveCount(0);
    await expect(page.getByRole('link', { name: /back|bumalik/i }).first()).toBeVisible();
  });

  test('admin login is a dedicated email/password surface', async ({ page }) => {
    // Use domcontentloaded so Firefox does not stall waiting for a slow resource.
    await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /admin|staff/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveCount(1);
    await expect(page.locator('input[type="password"]')).toHaveCount(1);
    await expect(page.locator('input[type="tel"]')).toHaveCount(0);
  });

  test('public pages have no serious or critical axe violations', async ({ page }) => {
    for (const route of ['/', '/benefits', '/help', '/privacy', '/apply', '/member', '/admin/login']) {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
      expect(serious, `${route} accessibility violations`).toEqual([]);
    }
  });
});
