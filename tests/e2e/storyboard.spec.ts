import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Storyboard interaction, content and accessibility.
 *
 * These specs run against the repository fallback content, which is the
 * state the page must work in when the governed registry is unreachable.
 * They deliberately do not wait for `networkidle`: this page sends
 * telemetry as the user reads, so network idle may never arrive, and a
 * test that waits for it would hang on correct behaviour.
 */

const BENEFITS = ['ambulance', 'blood', 'hospital', 'exclusions'] as const;

async function useLocale(page: Page, locale: 'fil' | 'en') {
  await page.addInitScript(
    (value) => window.localStorage.setItem('safecard-locale', value),
    locale,
  );
}

function tab(page: Page, id: string) {
  return page.locator(`#storyboard-tab-${id}`);
}

function panel(page: Page, id: string) {
  return page.locator(`#storyboard-panel-${id}`);
}

async function openBenefits(page: Page) {
  // Use domcontentloaded so Firefox does not stall waiting for a slow resource.
  // The hydration gate and CSS-variable wait below are the real readiness signals.
  await page.goto('/benefits', { waitUntil: 'domcontentloaded' });
  // A committed document can become visible before WebKit has applied the
  // stylesheet. Wait for the design token, fonts, and two paint frames so axe
  // measures the settled UI instead of a partially styled first paint.
  const storyboard = page.locator('.benefit-storyboard');
  await expect(storyboard).toBeVisible();
  await expect(storyboard).toHaveAttribute('data-hydrated', 'true');
  await page.waitForFunction(
    () => getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() !== '',
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

/** The panel fades in; scanning mid-animation reports semi-transparent text as a contrast failure. */
async function settlePanel(page: Page) {
  await page.locator('.benefit-panel:not([hidden])').evaluate(
    (node) =>
      new Promise<void>((resolve) => {
        const check = () => {
          if (node.getAnimations().every((animation) => animation.playState === 'finished')) resolve();
          else requestAnimationFrame(check);
        };
        check();
      }),
  );
}

test.describe('benefit guide', () => {
  test('lists all four benefits as tabs with the first one selected', async ({ page }) => {
    await openBenefits(page);
    for (const id of BENEFITS) {
      await expect(tab(page, id)).toBeVisible();
      expect(await tab(page, id).evaluate((node) => node.tagName)).toBe('BUTTON');
      await expect(tab(page, id)).toHaveAttribute('role', 'tab');
      await expect(tab(page, id)).toHaveAttribute('aria-controls', `storyboard-panel-${id}`);
    }
    await expect(tab(page, 'ambulance')).toHaveAttribute('aria-selected', 'true');
    await expect(panel(page, 'ambulance')).toBeVisible();
  });

  test('shows exactly one benefit at a time', async ({ page }) => {
    await openBenefits(page);
    await tab(page, 'blood').click();
    await expect(panel(page, 'blood')).toBeVisible();
    await expect(panel(page, 'ambulance')).toBeHidden();
    await expect(tab(page, 'ambulance')).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('.benefit-panel:not([hidden])')).toHaveCount(1);
  });

  test('arrow keys, Home and End move between benefits', async ({ page }) => {
    await openBenefits(page);
    await tab(page, 'ambulance').focus();
    await page.keyboard.press('ArrowDown');
    await expect(tab(page, 'blood')).toBeFocused();
    await expect(tab(page, 'blood')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(tab(page, 'exclusions')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(tab(page, 'ambulance')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(tab(page, 'exclusions')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(tab(page, 'ambulance')).toBeFocused();
  });

  test('only the selected tab is in the tab order, and hidden panels hold no focusable control', async ({ page }) => {
    await openBenefits(page);
    await tab(page, 'hospital').click();
    for (const id of BENEFITS) {
      await expect(tab(page, id)).toHaveAttribute('tabindex', id === 'hospital' ? '0' : '-1');
    }
    // `hidden` panels are display:none, so nothing inside them can take focus.
    await expect
      .poll(() => page.locator('.benefit-panel[hidden]').evaluateAll((panels) =>
        panels.every((item) => getComputedStyle(item).display === 'none'),
      ))
      .toBe(true);
  });

  test('each benefit carries persona, situation, action, PRC role and an illustration', async ({ page }) => {
    await useLocale(page, 'en');
    await openBenefits(page);

    for (const id of BENEFITS) {
      await tab(page, id).click();
      const open = panel(page, id);
      await expect(open).toBeVisible();
      await expect(open.locator('.benefit-persona strong')).not.toBeEmpty();
      await expect(open).toContainText('Situation');
      await expect(open).toContainText('What to do');
      await expect(open).toContainText('What PRC may provide');
      await expect(open.locator('.benefit-persona span')).toContainText(/sample scenario/i);
      await expect(open.locator('.benefit-disclaimer')).toHaveCount(0);
      const art = open.locator('.benefit-art svg');
      await expect(art).toHaveAttribute('aria-hidden', 'true');
    }
  });

  test('has no read tracking and no call button inside the benefits', async ({ page }) => {
    await openBenefits(page);
    await expect(page.getByRole('button', { name: /mark as read/i })).toHaveCount(0);
    await expect(page.locator('.storyboard-progress')).toHaveCount(0);
    await expect(page.locator('.benefit-storyboard').getByRole('link', { name: /call .*143/i })).toHaveCount(0);
    // The hotline lives in the one help area below the guide.
    await expect(page.locator('#help').getByRole('link', { name: /143/ }).first()).toHaveAttribute('href', 'tel:143');
  });

  test('does not clip the first line of a scenario', async ({ page }) => {
    await useLocale(page, 'en');
    await openBenefits(page);
    const persona = panel(page, 'ambulance').locator('.benefit-persona strong');
    const clipped = await persona.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const parent = node.closest('.benefit-panel')!.getBoundingClientRect();
      return box.top < parent.top;
    });
    expect(clipped).toBe(false);
  });

  test('shows no footnote and still records where the content came from', async ({ page }) => {
    await openBenefits(page);
    await expect(page.locator('.benefit-storyboard .content-footnote')).toHaveCount(0);
    // Without a published registry entry, the content must not claim approval.
    await expect(page.locator('.benefit-storyboard')).toHaveAttribute('data-provenance', 'provisional');
    await expect(page.locator('.benefit-storyboard')).not.toContainText(/pilot|provisional|validation/i);
  });

  for (const locale of ['fil', 'en'] as const) {
    test(`renders every benefit in ${locale}`, async ({ page }) => {
      await useLocale(page, locale);
      await openBenefits(page);
      for (const id of BENEFITS) {
        await tab(page, id).click();
        await expect(panel(page, id)).toBeVisible();
        await expect(panel(page, id).locator('.benefit-persona strong')).not.toBeEmpty();
      }
    });

    test(`has no serious accessibility violations in ${locale}`, async ({ page }) => {
      await useLocale(page, locale);
      await openBenefits(page);
      await settlePanel(page);

      const results = await new AxeBuilder({ page })
        .include('.benefit-storyboard')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      );
      expect(serious).toEqual([]);
    });
  }

  test('has no serious or critical page-level accessibility violations', async ({ page }) => {
    await openBenefits(page);
    await settlePanel(page);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    )).toEqual([]);
  });

  test('respects reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openBenefits(page);
    await tab(page, 'blood').click();

    // The shared rule uses the near-zero idiom (.01ms) rather than 0s.
    const seconds = await page
      .locator('.benefit-panel:not([hidden])')
      .evaluate((node) => parseFloat(getComputedStyle(node).animationDuration));
    expect(seconds).toBeLessThan(0.05);
  });

  test('keeps 44px touch targets', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await openBenefits(page);
    for (const id of BENEFITS) {
      const box = await tab(page, id).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test('does not scroll horizontally on a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await useLocale(page, 'fil');
    await openBenefits(page);
    await tab(page, 'hospital').click();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('keyboard focus stays visible across the tabs', async ({ page }) => {
    await openBenefits(page);
    for (const id of BENEFITS) {
      await tab(page, id).focus();
      const outline = await page.evaluate(() =>
        document.activeElement ? getComputedStyle(document.activeElement).outlineStyle : null,
      );
      expect(outline).not.toBe('none');
    }
  });
});

test.describe('governed content endpoint', () => {
  test('serves content and never fails when fallback exists', async ({ page }) => {
    const response = await page.request.get('/api/content/storyboard');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.content.cards).toHaveLength(4);
    expect(['approved', 'fallback']).toContain(body.source);
  });

  test('returns all four benefit ids exactly once', async ({ page }) => {
    const body = await (await page.request.get('/api/content/storyboard')).json();
    const ids = body.content.cards.map((card: { id: string }) => card.id).sort();
    expect(ids).toEqual([...BENEFITS].sort());
  });
});

test.describe('analytics collection', () => {
  const visitId = '22222222-2222-4222-8222-222222222222';

  test('accepts a valid event and returns no body', async ({ page }) => {
    const response = await page.request.post('/api/analytics/storyboard', {
      data: {
        events: [
          {
            benefit_id: 'ambulance',
            event_name: 'benefit_opened',
            locale: 'fil',
            duration_ms: 1200,
            visit_id: visitId,
          },
        ],
      },
    });
    expect(response.status()).toBe(204);
    expect((await response.body()).length).toBe(0);
  });

  test('rejects an invalid event name, benefit, locale and duration', async ({ page }) => {
    const invalid = [
      { event_name: 'page_view' },
      // Read tracking was removed with the "mark as read" control.
      { event_name: 'story_completed' },
      { benefit_id: 'dental' },
      { locale: 'es' },
      { duration_ms: -5 },
      { duration_ms: 99_999_999 },
    ];
    for (const override of invalid) {
      const response = await page.request.post('/api/analytics/storyboard', {
        data: {
          events: [
            {
              benefit_id: 'ambulance',
              event_name: 'benefit_opened',
              locale: 'fil',
              visit_id: visitId,
              ...override,
            },
          ],
        },
      });
      expect(response.status(), JSON.stringify(override)).toBe(400);
    }
  });

  test('rejects an event carrying anything identifying', async ({ page }) => {
    for (const field of ['application_ref', 'mobile_number', 'email', 'case_id', 'notes']) {
      const response = await page.request.post('/api/analytics/storyboard', {
        data: {
          events: [
            {
              benefit_id: 'ambulance',
              event_name: 'benefit_opened',
              locale: 'fil',
              visit_id: visitId,
              [field]: 'Maria Santos',
            },
          ],
        },
      });
      expect(response.status(), field).toBe(400);
    }
  });

  test('refuses raw event enumeration', async ({ page }) => {
    // There is no public read endpoint at all; the aggregate route
    // requires staff auth.
    const response = await page.request.get('/api/admin/analytics/storyboard');
    expect([401, 403]).toContain(response.status());
  });
});
