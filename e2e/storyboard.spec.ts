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

const BENEFITS = ['ambulance', 'blood', 'hospital_allowance', 'exclusions'] as const;

async function useLocale(page: Page, locale: 'fil' | 'en') {
  await page.addInitScript(
    (value) => window.localStorage.setItem('safecard-locale', value),
    locale,
  );
}

function header(page: Page, id: string) {
  return page.locator(`#storyboard-header-${id}`);
}

function panel(page: Page, id: string) {
  return page.locator(`#storyboard-panel-${id}`);
}

async function openBenefits(page: Page) {
  await page.goto('/benefits');
  // Readiness is the storyboard being present, not the network settling.
  await expect(page.locator('.benefit-storyboard')).toBeVisible();
}

test.describe('benefit storyboard', () => {
  test('renders all four benefits, collapsed', async ({ page }) => {
    await openBenefits(page);
    for (const id of BENEFITS) {
      await expect(header(page, id)).toBeVisible();
      await expect(header(page, id)).toHaveAttribute('aria-expanded', 'false');
      await expect(panel(page, id)).toBeHidden();
    }
  });

  test('every header is a real button', async ({ page }) => {
    await openBenefits(page);
    for (const id of BENEFITS) {
      expect(await header(page, id).evaluate((node) => node.tagName)).toBe('BUTTON');
      await expect(header(page, id)).toHaveAttribute('aria-controls', `storyboard-panel-${id}`);
    }
  });

  test('opens on click, Enter and Space', async ({ page }) => {
    await openBenefits(page);

    await header(page, 'ambulance').click();
    await expect(panel(page, 'ambulance')).toBeVisible();
    await header(page, 'ambulance').click();
    await expect(panel(page, 'ambulance')).toBeHidden();

    await header(page, 'blood').focus();
    await page.keyboard.press('Enter');
    await expect(panel(page, 'blood')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(panel(page, 'blood')).toBeHidden();

    await header(page, 'exclusions').focus();
    await page.keyboard.press('Space');
    await expect(panel(page, 'exclusions')).toBeVisible();
  });

  test('only one scenario is open at a time', async ({ page }) => {
    await openBenefits(page);
    await header(page, 'ambulance').click();
    await expect(panel(page, 'ambulance')).toBeVisible();

    await header(page, 'blood').click();
    await expect(panel(page, 'blood')).toBeVisible();
    await expect(panel(page, 'ambulance')).toBeHidden();
    await expect(header(page, 'ambulance')).toHaveAttribute('aria-expanded', 'false');
  });

  test('a closed panel holds no keyboard-focusable control', async ({ page }) => {
    await openBenefits(page);
    await header(page, 'ambulance').click();

    // The hotline link inside every *closed* panel must be unreachable.
    const reachable = await page.evaluate(() => {
      const focusables = Array.from(
        document.querySelectorAll('.story-panel a, .story-panel button'),
      );
      return focusables.filter((element) => {
        const panelElement = element.closest('.story-panel') as HTMLElement | null;
        return panelElement?.hidden === false || panelElement?.hasAttribute('hidden') === false;
      }).length;
    });
    // Exactly the one open panel contributes focusable controls.
    expect(reachable).toBeGreaterThan(0);

    const hiddenFocusables = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('.story-panel[hidden] a, .story-panel[hidden] button'))
          .length,
    );
    // They exist in the DOM but `hidden` takes them out of the tab order.
    const tabbable = await page.evaluate(() => {
      const active: string[] = [];
      document.querySelectorAll('.story-panel[hidden] a').forEach((element) => {
        const rect = (element as HTMLElement).getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) active.push(element.tagName);
      });
      return active.length;
    });
    expect(hiddenFocusables).toBeGreaterThan(0);
    expect(tabbable).toBe(0);
  });

  test('each scenario carries persona, situation, action, PRC role and a disclaimer', async ({
    page,
  }) => {
    await useLocale(page, 'en');
    await openBenefits(page);

    for (const id of BENEFITS) {
      await header(page, id).click();
      const open = panel(page, id);
      await expect(open).toBeVisible();
      await expect(open.locator('.story-persona')).not.toBeEmpty();
      await expect(open).toContainText('Situation');
      await expect(open).toContainText('What to do');
      await expect(open).toContainText('What PRC may provide');
      await expect(open.locator('.story-disclaimer')).toContainText(/illustrative/i);
      await expect(open.getByRole('link', { name: /143/ })).toBeVisible();
    }
  });

  test('marks a scenario read and shows completion', async ({ page }) => {
    await useLocale(page, 'en');
    await openBenefits(page);
    await expect(page.locator('.storyboard-progress')).toContainText('0/4');

    await header(page, 'ambulance').click();
    await panel(page, 'ambulance').getByRole('button', { name: /mark as read/i }).click();
    await expect(page.locator('.storyboard-progress')).toContainText('1/4');
    await expect(page.locator('.story-card.read')).toHaveCount(1);
  });

  test('offers a hotline call action', async ({ page }) => {
    await openBenefits(page);
    await header(page, 'ambulance').click();
    const link = panel(page, 'ambulance').getByRole('link', { name: /143/ });
    await expect(link).toHaveAttribute('href', 'tel:143');
  });

  test('says whether the content is approved or provisional', async ({ page }) => {
    await openBenefits(page);
    const provenance = page.locator('.storyboard-provenance');
    await expect(provenance).toBeVisible();
    // Without a published registry entry, it must not claim approval.
    await expect(provenance).toHaveAttribute('data-provenance', 'provisional');
  });

  for (const locale of ['fil', 'en'] as const) {
    test(`renders every benefit in ${locale}`, async ({ page }) => {
      await useLocale(page, locale);
      await openBenefits(page);
      for (const id of BENEFITS) {
        await header(page, id).click();
        await expect(panel(page, id)).toBeVisible();
        await expect(panel(page, id).locator('.story-disclaimer')).not.toBeEmpty();
      }
    });

    test(`has no serious accessibility violations in ${locale}`, async ({ page }) => {
      await useLocale(page, locale);
      await openBenefits(page);
      await header(page, 'ambulance').click();

      // Scoped to the storyboard, which is what this module owns. The
      // surrounding /benefits page carries pre-existing contrast
      // failures from the shared --text3 token (#8892A8 on white is
      // 3.12:1, under the 4.5:1 AA floor). Fixing that token changes
      // every page in the product, so it is reported in the PR rather
      // than silently altered from here — but this suite must not pass
      // by ignoring it either, hence the audit test below.
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

  test('records page-level violations this module did not introduce', async ({ page }) => {
    await openBenefits(page);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );

    // Every remaining serious finding on /benefits must be outside the
    // storyboard. If one ever lands inside it, this fails and names it.
    const insideStoryboard = serious.flatMap((violation) =>
      violation.nodes.filter((node) =>
        node.target.some((selector) => String(selector).includes('benefit-storyboard')),
      ),
    );
    expect(insideStoryboard).toEqual([]);

    if (serious.length > 0) {
      // Visible in the report without failing another module's work.
      console.warn(
        `[a11y] /benefits carries ${serious.length} pre-existing serious violation(s): ` +
          serious.map((violation) => violation.id).join(', '),
      );
    }
  });

  test('respects reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openBenefits(page);
    await header(page, 'ambulance').click();

    const transition = await page
      .locator('.story-card.open .story-indicator')
      .evaluate((node) => getComputedStyle(node).transitionDuration);
    expect(['0s', '0ms']).toContain(transition);
  });

  test('keeps 44px touch targets', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await openBenefits(page);
    for (const id of BENEFITS) {
      const box = await header(page, id).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test('does not scroll horizontally on a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await useLocale(page, 'fil');
    await openBenefits(page);
    await header(page, 'hospital_allowance').click();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('keyboard focus stays visible across the headers', async ({ page }) => {
    await openBenefits(page);
    await header(page, 'ambulance').focus();
    for (let step = 0; step < 4; step += 1) {
      const outline = await page.evaluate(() =>
        document.activeElement ? getComputedStyle(document.activeElement).outlineStyle : null,
      );
      expect(outline).not.toBe('none');
      await page.keyboard.press('Tab');
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
