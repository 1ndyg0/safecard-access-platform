import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('SafeCard public smoke and accessibility', () => {
  test('landing page is reachable without horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SafeCard/i);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test('benefit storyboard supports keyboard expansion and closure', async ({ page }) => {
    await page.goto('/benefits');
    const first = page.getByRole('button', { name: /Libreng Ambulansya/i }).first();
    const panelId = await first.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = page.locator(`#${panelId}`);
    await expect(panel).not.toHaveClass(/open/);
    await first.focus();
    await page.keyboard.press('Enter');
    await expect(first).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toHaveClass(/open/);
    await expect(panel).toHaveCSS('visibility', 'visible');
    const transitionSeconds = await panel.evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration));
    expect(transitionSeconds).toBeGreaterThan(0);
    await expect(page.getByText(/Illustrative only|Halimbawa lamang/i).first()).toBeVisible();
    await page.keyboard.press('Space');
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).not.toHaveClass(/open/);
    await expect(panel).toHaveCSS('visibility', 'hidden');
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
    for (const route of ['/', '/benefits', '/privacy', '/admin/login']) {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
      expect(serious, `${route} accessibility violations`).toEqual([]);
    }
  });
});
