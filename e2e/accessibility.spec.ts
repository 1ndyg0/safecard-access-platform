import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { seedWorld, type SeededWorld } from './fixtures/seed';
import { signIn } from './fixtures/auth';

let world: SeededWorld;

test.beforeAll(async () => {
  world = await seedWorld();
});

/** Only serious and critical findings block; minor ones are reported. */
async function scan(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
}

test.describe('accessibility', () => {
  test('the dashboard has no serious or critical violations', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

  test('the queue has no serious or critical violations', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await page.goto(`/admin/submissions?campaign_id=${world.campaignId}`);
    await expect(page.getByRole('heading', { name: 'Submissions' })).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

  test('case detail has no serious or critical violations', async ({ page }) => {
    await signIn(page, world.staff.finance);
    await page.goto(`/admin/submissions/${world.cases.approvedUnverifiedPayment}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

  test('every filter control has an associated label', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await page.goto(`/admin/submissions?campaign_id=${world.campaignId}`);

    for (const label of [
      'Application reference',
      'Consent',
      'Application',
      'Application review',
      'Payment',
      'PRC handoff',
      'Membership',
      'Sort',
    ]) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    }
  });

  test('the aging chart is mirrored by a real table', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    // The bars carry no information of their own.
    await expect(page.locator('.aging-chart')).toHaveAttribute('aria-hidden', 'true');
    // The same figures are readable as a table.
    const table = page.getByRole('table', {
      name: /cases awaiting review, by how long/i,
    });
    await expect(table).toBeVisible();
    await expect(table.getByRole('rowheader', { name: 'Under 24 hours' })).toBeVisible();
    await expect(table.getByRole('rowheader', { name: 'Over 3 days' })).toBeVisible();
  });

  test('keyboard focus stays visible while tabbing the filter bar', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await page.goto(`/admin/submissions?campaign_id=${world.campaignId}`);
    await page.getByLabel('Application reference').focus();

    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press('Tab');
      const outline = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element) return null;
        const style = getComputedStyle(element);
        return { width: style.outlineWidth, style: style.outlineStyle, tag: element.tagName };
      });
      expect(outline).not.toBeNull();
      expect(outline?.style).not.toBe('none');
    }
  });

  test('the queue is operable by keyboard alone', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await page.goto(`/admin/submissions?campaign_id=${world.campaignId}`);

    await page.getByLabel('Payment').focus();
    await page.getByLabel('Payment').selectOption('verified_by_official_source');
    await page.getByRole('button', { name: 'Apply' }).press('Enter');

    await expect(page).toHaveURL(/payment_state=verified_by_official_source/);
  });

  test('errors and results are announced', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await page.goto(`/admin/submissions?campaign_id=${world.campaignId}`);
    const live = page.locator('[role="status"][aria-live="polite"]').first();
    await expect(live).toBeAttached();
  });

  test('long translated content does not overflow the page horizontally', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await page.goto(`/admin/submissions?campaign_id=${world.campaignId}`);

    // The table scrolls inside its own container; the body must not.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
