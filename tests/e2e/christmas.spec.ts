import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Christmas 2026 campaign (src/lib/seasonal). Always on: no date window, no switch, no gifting. */

async function setLocale(page: Page, locale: 'fil' | 'en') {
  await page.addInitScript((value) => window.localStorage.setItem('safecard-locale', value), locale);
}

test.beforeEach(async ({ page }) => { await setLocale(page, 'en'); });

async function sideways(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? '')).map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`);
}

test.describe('campaign', () => {
  test('landing page is festive and the original hero is untouched', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('xmas-top')).toBeVisible();
    await expect(page.getByTestId('xmas-band')).toBeVisible();
    await expect(page.locator('.hero-grid #hero-title')).toBeVisible();
    await expect(page.locator('.hero-actions a[href="/apply"]')).toBeVisible();
    await expect(page.locator('.xmas-foot-tag')).toBeVisible();
    await expect(page.locator('.xmas-garland').first()).toBeVisible();
    // Same amounts as the benefits section.
    expect(await page.getByTestId('xmas-band').innerText()).toMatch(/300,000/);
  });

  test('the band and the strip lead to the application', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('xmas-band').getByRole('link', { name: /apply now/i }).click();
    await expect(page).toHaveURL(/\/apply$/);
  });

  test('Santa, the reindeer and friends stand between the sections', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.xmas-scene')).toHaveCount(5);
    for (const name of ['santa', 'reindeer', 'snowman', 'tree', 'gingerbread']) {
      await expect(page.locator(`.xmas-scene img.xmas-art-${name}`).first(), name).toBeAttached();
    }
    await expect(page.locator('.xmas-flyby')).toHaveCount(1);
    await expect(page.getByTestId('xmas-band').getByRole('img')).toHaveAttribute('alt', /Santa/);
    // Every picture loads.
    const broken = await page.evaluate(() => [...document.images].filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.src));
    expect(broken).toEqual([]);
  });

  test('decoration is hidden from screen readers and never takes a click', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.xmas-scene img:not([alt=""])')).toHaveCount(0);
    const pointer = await page.evaluate(() => [...document.querySelectorAll('.xmas-scene, .xmas-snow, .xmas-lights, .xmas-garland')].map((node) => getComputedStyle(node).pointerEvents));
    expect(pointer.every((value) => value === 'none')).toBe(true);
    await expect(page.locator('.xmas-scene').first().locator('xpath=..')).toHaveAttribute('aria-hidden', 'true');
  });

  test('the application is decorated except on the payment step', async ({ page }) => {
    await page.goto('/apply');
    await expect(page.locator('.xmas-garland.light')).toBeVisible();
    await expect(page.locator('.wizard-card .xmas-garland, .wizard-card .xmas-snow, .wizard-card .xmas-scene')).toHaveCount(0);
  });

  test('snow, swinging bells and the flying sleigh stay still for reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.xmas-snow').first()).toBeHidden();
    const names = await page.evaluate(() => ['.xmas-lights', '.xmas-flyby', '.xmas-strip-art', '.xmas-art-santa'].map((selector) => getComputedStyle(document.querySelector(selector)!).animationName));
    expect(names).toEqual(['none', 'none', 'none', 'none']);
  });

  test('the Filipino site is festive too', async ({ page }) => {
    await setLocale(page, 'fil');
    await page.goto('/');
    await expect(page.getByTestId('xmas-top')).toContainText('Maligayang Pasko');
    await expect(page.getByTestId('xmas-band')).toContainText('Mag-apply');
  });
});

test.describe('gifting is gone', () => {
  test('the gift pages do not exist', async ({ page }) => {
    for (const path of ['/gift', '/gift/card']) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });

  test('no page offers a gift link, button or welcome', async ({ page }) => {
    for (const path of ['/', '/benefits', '/help', '/apply', '/apply?gift=1']) {
      await page.goto(path);
      const gifts = await page.evaluate(() => [...document.querySelectorAll('a, button')].map((node) => `${node.textContent ?? ''} ${node.getAttribute('href') ?? ''}`).filter((text) => /\bgift|regalo/i.test(text)));
      expect(gifts, path).toEqual([]);
      await expect(page.getByTestId('gift-welcome')).toHaveCount(0);
    }
  });
});

test.describe('accessibility and layout', () => {
  const pages = ['/', '/benefits', '/help', '/apply'];
  for (const locale of ['en', 'fil'] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`no serious axe violations (${locale}, ${scheme})`, async ({ page }) => {
        await setLocale(page, locale);
        await page.emulateMedia({ colorScheme: scheme });
        for (const path of pages) {
          await page.goto(path);
          await page.waitForTimeout(500);
          expect(await seriousViolations(page), `${path} ${locale} ${scheme}`).toEqual([]);
        }
      });
    }
  }

  for (const width of [320, 375, 768, 1440]) {
    test(`no sideways scrolling at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const path of pages) {
        await page.goto(path);
        await page.waitForTimeout(300);
        expect(await sideways(page), `${path} at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});
