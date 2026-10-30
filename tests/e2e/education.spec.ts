import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createMemberToken } from '../../src/lib/auth/member-token';

/**
 * Landing-page education sections, the document downloads, and the member
 * library. Runs on every project in playwright.config.ts, which together
 * cover laptops, tablets and iOS and Android phones.
 */

const PILOT_WORDING = /pilot|school-project|for validation|working baseline|illustrative|synthetic|demo\b/i;
/** Everything on request (E2E_ALL_DEVICES=1); a lighter sweep otherwise, to keep the CI job short. */
const FULL = process.env.E2E_ALL_DEVICES === '1';
const SECTION_IDS = ['benefits', 'covered', 'accident', 'process', 'faq', 'downloads'] as const;

async function setLocale(page: Page, locale: 'fil' | 'en') {
  await page.addInitScript((value) => window.localStorage.setItem('safecard-locale', value), locale);
}

/** The site opens in Filipino for a first-time visitor, so every test states its language. */
test.beforeEach(async ({ page }) => { await setLocale(page, 'en'); });

/** The language switch is in the header on wide screens and inside the menu on narrow ones. */
async function languageButton(page: Page, name: 'FIL' | 'EN') {
  const visible = page.locator('.locale-switch:visible').first();
  if (!(await visible.count())) {
    await page.getByRole('button', { name: /^(Menu|Menu)$/ }).click();
  }
  return page.locator('.locale-switch:visible').first().getByRole('button', { name });
}

async function overflow(page: Page) {
  return page.evaluate(() => ({
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    // Anything that sticks out of the viewport and is not inside a scroller built to scroll sideways.
    offenders: Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((element) => {
        const box = element.getBoundingClientRect();
        if (box.width === 0 || box.right <= document.documentElement.clientWidth + 1) return false;
        for (let node: HTMLElement | null = element; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (/(auto|scroll|hidden|clip)/.test(style.overflowX) && node !== document.body && node !== document.documentElement) return false;
        }
        return true;
      })
      .slice(0, 5)
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`),
  }));
}

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  return results.violations
    .filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))
    .map((violation) => `${violation.id}: ${violation.nodes.slice(0, 3).map((node) => node.target.join(' ')).join(' | ')}`);
}

test.describe('landing page: structure', () => {
  test('has every section, in order, with one h1', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const order = await page.evaluate((ids) => ids.map((id) => document.getElementById(id)?.getBoundingClientRect().top ?? -1), [...SECTION_IDS]);
    expect(order.every((top) => top >= 0), 'every section id exists').toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('₱1,200 a year');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('₱300,000');
    await expect(page.locator('.hero-copy')).not.toContainText('underwritten');
    await expect(page.locator('#benefits, main').first()).toContainText('Prudential Guarantee');
  });

  test('toolbar section links jump to their sections', async ({ page }) => {
    // The toolbar shows the section links inline from 1300px; below that they sit in the menu.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const nav = page.locator('header').getByRole('navigation', { name: 'Primary navigation' });
    for (const [label, id] of [['Is it covered?', 'covered'], ['After an accident', 'accident'], ['Questions', 'faq'], ['Downloads', 'downloads']] as const) {
      await nav.getByRole('link', { name: label }).click();
      await expect.poll(() => page.evaluate((target) => Math.abs(document.getElementById(target)!.getBoundingClientRect().top), id), { timeout: 5000 }).toBeLessThan(160);
      await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'true');
    }
  });

  test('"See what is covered" goes to the coverage section', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'See what is covered' }).click();
    await expect(page).toHaveURL(/#covered$/);
  });

  test('keeps the header and footer links that point into the page', async ({ page }) => {
    await page.goto('/');
    for (const id of ['benefits', 'process', 'faq', 'downloads']) {
      await expect(page.locator(`footer a[href="/#${id}"], header a[href="/#${id}"]`).first()).toBeAttached();
    }
    await expect(page.getByRole('link', { name: 'See how each benefit works in real situations' })).toHaveAttribute('href', '/benefits');
  });
});

test.describe('landing page: content', () => {
  test('states the published amounts, deadlines and waiting periods', async ({ page }) => {
    await page.goto('/');
    const benefits = page.locator('#benefits');
    for (const text of ['₱300,000', '₱10,000', '₱5,000', '₱200 a day', 'up to 60 days', 'at least 24 hours', 'Per accident']) {
      await expect(benefits).toContainText(text);
    }
    await expect(page.locator('.edu-footnote, .edu-note')).toHaveCount(0);
    const covered = page.locator('#covered');
    for (const text of ['Day 1', '30 days', '6 months', 'Racing and risky sports', 'Typhoon, flood']) await expect(covered).toContainText(text);
    const accident = page.locator('#accident');
    for (const text of ['Call 143 right away', 'By day 30', 'By day 60', 'maabclaims@redcross.org.ph', 'Death certificate']) await expect(accident).toContainText(text);
    await expect(page.locator('.process-note, .voluntary-line, .help-hint, .benefit-tip, .portal-footnote')).toHaveCount(0);
  });

  test('has no pilot wording and never says free or guaranteed', async ({ page }) => {
    await page.goto('/');
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(PILOT_WORDING);
    expect(text).not.toMatch(/\bfree\b|\bguaranteed\b/i);
  });

  test('covered and not-covered lists are the same height', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const heights = await page.locator('.edu-cover .edu-group').evaluateAll((groups) => groups.map((group) => Math.round(group.getBoundingClientRect().height)));
    expect(heights).toHaveLength(2);
    expect(heights[0]).toBe(heights[1]);
  });
});

test.describe('landing page: language', () => {
  test('switches every section to Filipino and back', async ({ page }) => {
    await page.goto('/');
    await (await languageButton(page, 'FIL')).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('₱1,200 kada taon');
    await expect(page.locator('#benefits h2')).toContainText('Pera para sa iyo');
    await expect(page.locator('#covered h2')).toContainText('Ano ang sakop');
    await expect(page.locator('#accident h2')).toContainText('Tatlong gagawin');
    await expect(page.locator('#faq h2')).toContainText('Mabilis na sagot');
    await expect(page.locator('#downloads h2')).toContainText('Dalhin ito sa iyo');
    await expect(page.locator('header').getByRole('navigation', { name: 'Pangunahing nabigasyon' })).toBeVisible();
    await (await languageButton(page, 'EN')).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('₱1,200 a year');
  });

  test('has no English left in the Filipino sections', async ({ page }) => {
    await setLocale(page, 'fil');
    await page.goto('/');
    for (const id of ['benefits', 'covered', 'accident', 'faq']) {
      const text = await page.locator(`#${id}`).innerText();
      expect(text, id).not.toMatch(/\b(What you get|What is covered|Quick answers|What to bring|Call 143 right away)\b/);
    }
  });
});

test.describe('landing page: questions', () => {
  test('search narrows the list and says when nothing matches', async ({ page }) => {
    await page.goto('/');
    const faq = page.locator('#faq');
    await expect(faq.locator('details')).toHaveCount(13);
    await faq.getByRole('searchbox').fill('lost card');
    await expect(faq.locator('details:visible')).toHaveCount(1);
    await expect(faq.locator('details:visible summary')).toContainText('lose my card');
    await expect(faq.getByRole('status')).toContainText('1 question shown');
    await faq.getByRole('searchbox').fill('zzzz');
    await expect(faq.locator('details:visible')).toHaveCount(0);
    await expect(faq.getByText('Nothing matches')).toBeVisible();
    await faq.getByRole('searchbox').fill('');
    await expect(faq.locator('details:visible')).toHaveCount(13);
  });

  test('opens with the keyboard and links to the section that explains it', async ({ page }) => {
    await page.goto('/');
    const summary = page.locator('#faq summary', { hasText: 'How do I claim my benefits?' });
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(summary).toBeVisible();
    await expect(page.locator('#faq details[open]')).toHaveCount(1);
    await page.getByRole('link', { name: 'See the steps and deadlines' }).click();
    await expect(page).toHaveURL(/#accident$/);
  });
});

test.describe('documents', () => {
  test('public documents download as PDFs', async ({ request }) => {
    for (const [slug, name] of [['program-overview', 'Safe-Card-Program-Overview.pdf'], ['faqs', 'Safe-Card-FAQs.pdf']] as const) {
      const response = await request.get(`/api/documents/${slug}`);
      expect(response.status(), slug).toBe(200);
      expect(response.headers()['content-type']).toBe('application/pdf');
      expect(response.headers()['content-disposition']).toBe(`attachment; filename="${name}"`);
      const body = await response.body();
      expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(body.byteLength).toBe(Number(response.headers()['content-length']));
    }
  });

  test('opens in the browser viewer when asked', async ({ request }) => {
    const response = await request.get('/api/documents/faqs?view=1');
    expect(response.headers()['content-disposition']).toMatch(/^inline;/);
  });

  test('the member guide is refused without a member session', async ({ request }) => {
    const response = await request.get('/api/documents/member-guide');
    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
    expect((await request.get('/api/documents/nothing')).status()).toBe(404);
  });

  test('the landing page offers the two public documents and not the guide', async ({ page }) => {
    await page.goto('/');
    const downloads = page.locator('#downloads');
    await expect(downloads.getByRole('link', { name: /^Download/ })).toHaveCount(2);
    await expect(downloads.getByRole('link', { name: /Open in browser/ })).toHaveCount(2);
    await expect(downloads).toContainText('PDF · 19 slides · English · 1.3 MB');
    await expect(downloads).toContainText('PDF · 2 pages · English · 2.7 MB');
    await expect(page.locator('a[href*="member-guide"]')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText('Member guide');
  });
});

test.describe('every screen size', () => {
  const widths = FULL ? [320, 360, 375, 390, 412, 600, 768, 820, 1024, 1280, 1440, 1920] : [320, 390, 768, 1024, 1440];

  for (const locale of ['en', 'fil'] as const) {
    test(`landing page never overflows sideways (${locale})`, async ({ page }) => {
      test.setTimeout(150_000);
      await setLocale(page, locale);
      for (const width of widths) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('load');
        const result = await overflow(page);
        expect(result.page, `${width}px page overflow`).toBeLessThanOrEqual(0);
        expect(result.offenders, `${width}px offenders`).toEqual([]);
      }
    });
  }

  test('controls are at least 44px tall', async ({ page }) => {
    await page.goto('/');
    const small = await page
      .locator('.site-nav a, .edu-doc-actions a, .edu-call a, .edu-faq summary, .edu-search input, .edu-text-link')
      .evaluateAll((elements) => elements.filter((element) => element.getBoundingClientRect().height > 0 && element.getBoundingClientRect().height < 43.5).map((element) => `${element.tagName}.${element.className} ${Math.round(element.getBoundingClientRect().height)}px`));
    expect(small).toEqual([]);
  });

  test('inputs are 16px so iOS does not zoom the page', async ({ page }) => {
    await page.goto('/');
    expect(await page.locator('#faq-search-landing').evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  });

  test('images load and keep their proportions', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      document.querySelectorAll('img').forEach((image) => { image.loading = 'eager'; });
      await Promise.all(Array.from(document.images).map((image) => image.complete ? null : new Promise((resolve) => { image.onload = image.onerror = resolve; })));
    });
    const broken = await page.evaluate(() => Array.from(document.images).filter((image) => !image.naturalWidth).map((image) => image.src));
    expect(broken).toEqual([]);
    const squashed = await page.evaluate(() => Array.from(document.images)
      .filter((image) => image.getBoundingClientRect().width > 0 && image.className !== '' && !image.className.includes('thumb'))
      // offsetWidth/Height ignore the tilt applied to the two cards in the hero.
      .filter((image) => Math.abs(image.offsetWidth / image.offsetHeight - image.naturalWidth / image.naturalHeight) > 0.05 && !image.closest('.edu-visual, .edu-doc-thumb'))
      .map((image) => image.src));
    expect(squashed).toEqual([]);
  });
});

test.describe('accessibility', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const locale of ['en', 'fil'] as const) {
      // Light + English and dark + Filipino always; the other two pairs on request.
      if (!FULL && (scheme === 'light') !== (locale === 'en')) continue;
      test(`landing page has no serious violations (${scheme}, ${locale})`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.emulateMedia({ colorScheme: scheme });
        await setLocale(page, locale);
        await page.goto('/');
        await page.getByRole('searchbox').fill('card');
        expect(await seriousViolations(page)).toEqual([]);
      });
    }
  }

  test('respects reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  });
});

// ------------------------------------------------------------------ member library
const SECRET = process.env.MEMBER_SESSION_SECRET;

async function signIn(page: Page) {
  const baseURL = new URL(page.url() === 'about:blank' ? (test.info().project.use.baseURL ?? 'http://127.0.0.1:3102') : page.url());
  await page.context().addCookies([{
    name: 'sc_member_session',
    value: createMemberToken('11111111-1111-4111-8111-111111111111'),
    domain: baseURL.hostname,
    path: '/',
    httpOnly: true,
    secure: baseURL.protocol === 'https:',
    sameSite: 'Lax',
  }]);
}

test.describe('member library', () => {
  test('sends a visitor without a session to the member sign-in', async ({ page }) => {
    for (const route of ['/member/library', '/member/library/guide', '/member/library/faq']) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/member$/);
    }
  });

  test.describe('signed in', () => {
    test.skip(!SECRET, 'MEMBER_SESSION_SECRET must be set for the test server and the test runner');
    test.beforeEach(async ({ page }) => { await signIn(page); });

    test('shows the guide and the questions, with the member navigation', async ({ page }) => {
      await page.goto('/member/library');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your Safe Card library');
      const nav = page.getByRole('navigation', { name: 'Member sections' });
      await expect(nav.getByRole('link', { name: 'Library' })).toHaveAttribute('aria-current', 'page');
      await expect(nav.getByRole('link', { name: 'My card' })).toHaveAttribute('href', '/member/card');
      await expect(nav.getByRole('link', { name: 'Status' })).toHaveAttribute('href', '/member/status');
      await expect(page.getByRole('heading', { level: 2, name: 'Member Guide 2026' })).toBeVisible();
      await expect(page.getByText('PDF · 59 pages · English · 1.4 MB')).toBeVisible();
      const download = page.locator('a[href="/api/documents/member-guide"]');
      await expect(download).toHaveCount(1);
      await expect(download).toHaveAttribute('download', 'PRC-Safe-Card-Member-Guide-2026.pdf');
      await expect(download).toContainText('Download');
    });

    test('downloads the guide with the member session', async ({ page }) => {
      await page.goto('/member/library');
      const response = await page.request.get('/api/documents/member-guide');
      expect(response.status()).toBe(200);
      expect(response.headers()['content-disposition']).toContain('PRC-Safe-Card-Member-Guide-2026.pdf');
      expect(response.headers()['cache-control']).toContain('no-store');
      expect((await response.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });

    test('reads the guide on screen, section by section', async ({ page }) => {
      await page.goto('/member/library/guide');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('PRC Safe Card Member Guide 2026');
      for (const title of ['What your Safe Card means', 'Accident assistance benefits', 'How to file an accident claim', 'Claim document checklist', 'Member acknowledgment']) {
        await expect(page.getByRole('heading', { level: 2, name: new RegExp(title) })).toBeAttached();
      }
      const benefits = page.locator('#benefits');
      await expect(benefits.getByRole('row', { name: /Hospital Daily Allowance ₱200\/day, up to 60 days/ })).toBeAttached();
      await expect(page.locator('#notice')).toContainText('is NOT an insurer');
      await expect(page.locator('#benefits .reader-source')).toHaveAttribute('href', '/api/documents/member-guide?view=1#page=8');
      await expect(page.locator('#directory .button-quiet')).toHaveAttribute('href', '/api/documents/member-guide?view=1#page=25');
    });

    test('opens a section directly from a link', async ({ page }) => {
      await page.goto('/member/library/guide#claims');
      await expect.poll(() => page.evaluate(() => Math.abs(document.getElementById('claims')!.getBoundingClientRect().top)), { timeout: 5000 }).toBeLessThan(140);
    });

    test('shows the same questions as the landing page', async ({ page }) => {
      await page.goto('/member/library/faq');
      await expect(page.locator('details')).toHaveCount(13);
      await page.getByRole('searchbox').fill('renew');
      await expect(page.locator('details:visible')).toHaveCount(1);
      await page.getByRole('searchbox').fill('');
      await page.locator('summary', { hasText: 'How do I claim my benefits?' }).click();
      await page.getByRole('link', { name: 'See the steps and deadlines' }).click();
      await expect(page).toHaveURL(/\/member\/library\/guide#claims$/);
    });

    test('keeps the guide in English and says so in Filipino', async ({ page }) => {
      await setLocale(page, 'fil');
      await page.goto('/member/library/guide');
      await expect(page.getByText('Ingles lamang ang Member Guide')).toBeVisible();
      await expect(page.locator('.reader')).toHaveAttribute('lang', 'en');
    });

    for (const width of FULL ? [320, 390, 768, 1024, 1440] : [320, 768, 1440]) {
      test(`never overflows sideways at ${width}px`, async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width, height: 800 });
        for (const route of ['/member/library', '/member/library/guide', '/member/library/faq']) {
          await page.goto(route);
          await page.waitForLoadState('load');
          const result = await overflow(page);
          expect(result.page, `${route} page overflow`).toBeLessThanOrEqual(0);
          expect(result.offenders, `${route} offenders`).toEqual([]);
        }
      });
    }

    for (const scheme of ['light', 'dark'] as const) {
      test(`has no serious accessibility violations (${scheme})`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.emulateMedia({ colorScheme: scheme });
        for (const route of ['/member/library', '/member/library/guide', '/member/library/faq']) {
          await page.goto(route);
          expect(await seriousViolations(page), route).toEqual([]);
        }
      });
    }
  });
});
