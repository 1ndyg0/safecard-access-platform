import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Christmas 2026 campaign (src/lib/seasonal). The date window is not what these
 * tests rely on: `?season=christmas` and `?season=off` switch it per visit, so
 * they pass whatever day they run. The window and the kill switch are covered
 * by src/lib/seasonal/christmas.test.ts.
 */

const ON = '?season=christmas';
const OFF = '?season=off';

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

test.describe('season off: the app is exactly as before', () => {
  test('landing page shows no seasonal markup and keeps its hero', async ({ page }) => {
    await page.goto(`/${OFF}`);
    await expect(page.locator('html')).not.toHaveAttribute('data-season', 'christmas');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /apply|mag-apply/i }).first()).toBeVisible();
    for (const selector of ['[data-testid="xmas-band"]', '[data-testid="xmas-top"]', '.xmas-garland', '.xmas-snow', '.xmas-nav-link', '.xmas-foot-tag']) {
      await expect(page.locator(selector).first(), selector).toBeHidden();
    }
  });

  test('gift pages send a visitor home', async ({ page }) => {
    for (const path of ['/gift', '/gift/card']) {
      await page.goto(`${path}${OFF}`);
      await expect(page).toHaveURL(/\/$/);
    }
  });

  test('application shows no gift welcome even with the gift link', async ({ page }) => {
    await page.goto(`/apply?gift=1&season=off`);
    await expect(page.getByTestId('gift-welcome')).toBeHidden();
  });
});

test.describe('season on', () => {
  test('landing page gains a gift band and the original hero is untouched', async ({ page }) => {
    await page.goto(`/${ON}`);
    await expect(page.locator('html')).toHaveAttribute('data-season', 'christmas');
    await expect(page.getByTestId('xmas-top')).toBeVisible();
    await expect(page.getByTestId('xmas-band')).toBeVisible();
    await expect(page.locator('.hero-grid #hero-title')).toBeVisible();
    await expect(page.locator('.hero-actions a[href="/apply"]')).toBeVisible();
    await expect(page.locator('.xmas-foot-tag')).toBeVisible();
    // The band shows the same amounts as the benefits section.
    const band = await page.getByTestId('xmas-band').innerText();
    expect(band).toMatch(/300,000/);
  });

  test('the Gift link and the band lead to the gift pages', async ({ page }) => {
    await page.goto(`/${ON}`);
    await page.getByTestId('xmas-band').getByRole('link').nth(1).click();
    await expect(page).toHaveURL(/\/gift$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.xmas-faq details')).toHaveCount(5);
    await expect(page.locator('.xmas-steps li')).toHaveCount(3);
    await page.getByRole('link', { name: /create a gift card/i }).first().click();
    await expect(page).toHaveURL(/\/gift\/card$/);
  });

  test('gift link opens the application with a welcome and nothing else changed', async ({ page }) => {
    await page.goto(`/apply?gift=1&season=christmas`);
    await expect(page.getByTestId('gift-welcome')).toBeVisible();
    await expect(page.locator('.wizard-card h1')).toBeVisible();
    await page.goto(`/apply?season=christmas`);
    await expect(page.getByTestId('gift-welcome')).toHaveCount(0);
  });

  test('application garland is quiet and sits above, not inside, the form', async ({ page }) => {
    await page.goto(`/apply?season=christmas`);
    await expect(page.locator('.xmas-garland.light')).toBeVisible();
    await expect(page.locator('.wizard-card .xmas-garland, .wizard-card .xmas-snow')).toHaveCount(0);
  });

  test('snow stays still for people who prefer reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/${ON}`);
    // The whole snow layer is removed from rendering, so no flake animates.
    await expect(page.locator('.xmas-snow').first()).toBeHidden();
    await expect(page.locator('.xmas-lights').first()).toBeVisible();
    const lights = await page.locator('.xmas-lights').first().evaluate((node) => getComputedStyle(node).animationName);
    expect(lights).toBe('none');
  });
});

test.describe('gift card maker', () => {
  test('the card changes with the names and the message carries them', async ({ page }) => {
    await page.goto(`/gift/card${ON}`);
    const canvas = page.getByTestId('gift-card-canvas');
    await expect(canvas).toBeVisible();
    const snapshot = () => canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
    await page.waitForTimeout(400);
    const before = await snapshot();
    await page.getByLabel(/your name/i).fill('Ana');
    await page.getByLabel(/their name/i).fill('Lola Nena');
    await page.waitForTimeout(200);
    const after = await snapshot();
    expect(after).not.toBe(before);
    await expect(page.locator('.xmas-message')).toContainText('Merry Christmas, Lola Nena');
    await expect(page.locator('.xmas-message')).toContainText('Ana');
    await expect(canvas).toHaveAttribute('aria-label', /Lola Nena/);
    await expect(canvas).toHaveAttribute('width', '1080');
  });

  test('angle brackets and control characters never reach the card or message', async ({ page }) => {
    await page.goto(`/gift/card${ON}`);
    await page.getByLabel(/their name/i).fill('<img src=x onerror=alert(1)>');
    await expect(page.locator('.xmas-message')).not.toContainText('<');
    await expect(page.locator('.xmas-form img')).toHaveCount(0);
    expect(await page.getByLabel(/their name/i).inputValue()).not.toMatch(/[<>]/);
  });

  test('long names are cut so the card cannot overflow', async ({ page }) => {
    await page.goto(`/gift/card${ON}`);
    await page.getByLabel(/their name/i).fill('A'.repeat(80));
    const value = await page.getByLabel(/their name/i).inputValue();
    expect(value.length).toBeLessThanOrEqual(24);
  });

  test('download produces a PNG', async ({ page }) => {
    await page.goto(`/gift/card${ON}`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /download image/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('safecard-gift.png');
    await expect(page.getByRole('status')).toHaveText(/saved/i);
  });

  test('copy puts the message on the clipboard', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __copied: string[] }).__copied = [];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { (window as unknown as { __copied: string[] }).__copied.push(text); } } });
    });
    await page.goto(`/gift/card${ON}`);
    await page.getByLabel(/their name/i).fill('Ben');
    await page.getByRole('button', { name: /copy message/i }).click();
    await expect(page.getByRole('status')).toHaveText(/copied/i);
    const copied = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied);
    expect(copied[0]).toContain('Merry Christmas, Ben');
    expect(copied[0]).toContain('/apply?gift=1');
    expect(copied[0]).not.toMatch(/season=/);
  });

  test('Share button only appears where the browser can share, and shares text and image', async ({ page }) => {
    await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); });
    await page.goto(`/gift/card${ON}`);
    await expect(page.getByRole('button', { name: /download image/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^share/i })).toHaveCount(0);

    const sharing = await page.context().newPage();
    await sharing.addInitScript(() => {
      localStorage.setItem('safecard-locale', 'en');
      const calls: unknown[] = [];
      (window as unknown as { __shared: unknown[] }).__shared = calls;
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => { calls.push({ text: data.text, files: (data.files ?? []).map((file) => `${file.name}:${file.type}`) }); } });
    });
    await sharing.goto(`/gift/card${ON}`);
    await sharing.getByRole('button', { name: /^share/i }).click();
    await expect(sharing.getByRole('status')).toHaveText(/./);
    const shared = await sharing.evaluate(() => (window as unknown as { __shared: { text: string; files: string[] }[] }).__shared);
    expect(shared).toHaveLength(1);
    expect(shared[0].files).toEqual(['safecard-gift.png:image/png']);
    expect(shared[0].text).toContain('/apply?gift=1');
  });

  test('closing the share sheet is not reported as an error', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('closed', 'AbortError'); } });
    });
    await page.goto(`/gift/card${ON}`);
    await page.getByRole('button', { name: /^share/i }).click();
    await expect(page.getByRole('status')).toHaveText('');
  });

  test('nothing is sent to a server and nothing is stored', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => { if (request.method() !== 'GET') requests.push(`${request.method()} ${request.url()}`); });
    await page.goto(`/gift/card${ON}`);
    await page.getByLabel(/their name/i).fill('Private Name');
    await page.getByLabel(/your name/i).fill('Another Name');
    await page.getByRole('button', { name: /download image/i }).click();
    expect(requests).toEqual([]);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
    expect(stored).not.toMatch(/Private Name|Another Name/);
  });

  test('Filipino card text can be chosen independently of the site language', async ({ page }) => {
    await page.goto(`/gift/card${ON}`);
    await page.getByLabel(/their name/i).fill('Lola');
    await page.locator('.xmas-segment').getByText('Filipino', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Filipino' })).toBeChecked();
    await expect(page.locator('.xmas-message')).toContainText('Maligayang Pasko, Lola');
    await page.locator('.xmas-segment').getByText('English', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'English' })).toBeChecked();
    await expect(page.locator('.xmas-message')).toContainText('Merry Christmas, Lola');
  });
});

test.describe('accessibility and layout in season', () => {
  const pages = ['/', '/gift', '/gift/card', '/apply?gift=1'];
  for (const locale of ['en', 'fil'] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`no serious axe violations (${locale}, ${scheme})`, async ({ page }) => {
        await setLocale(page, locale);
        await page.emulateMedia({ colorScheme: scheme });
        for (const path of pages) {
          await page.goto(`${path}${path.includes('?') ? '&' : '?'}season=christmas`);
          await expect(page.locator('html')).toHaveAttribute('data-season', 'christmas');
          // Let fonts and the card art settle so colours are final.
          await page.waitForTimeout(500);
          expect(await seriousViolations(page), `${path} ${locale} ${scheme}`).toEqual([]);
        }
      });
    }
  }

  for (const width of [320, 375, 768]) {
    test(`no sideways scrolling at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const path of pages) {
        await page.goto(`${path}${path.includes('?') ? '&' : '?'}season=christmas`);
        await page.waitForTimeout(300);
        expect(await sideways(page), `${path} at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }

  test('keyboard can reach and operate the card maker', async ({ page }) => {
    await page.goto(`/gift/card${ON}`);
    await page.getByLabel(/your name/i).focus();
    await page.keyboard.type('Ana');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Ben');
    await expect(page.locator('.xmas-message')).toContainText('Merry Christmas, Ben');
  });
});
