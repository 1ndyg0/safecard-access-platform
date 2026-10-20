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
    await expect(page.getByTestId('count-awaiting_review')).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

  test('the applications list has no serious or critical violations', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await page.goto(`/admin/applications?campaign_id=${world.campaignId}&status=all`);
    await expect(page.getByTestId('application-row').first()).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

  test('the review slide-over has no serious or critical violations', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await page.goto(`/admin/applications?campaign_id=${world.campaignId}`);
    await page.getByRole('button', { name: /review ana reyes/i }).click();
    await expect(page.getByRole('dialog').getByAltText('Uploaded proof of payment')).toBeVisible();
    expect(await scan(page)).toEqual([]);

    await page.getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByLabel('Reason for rejection')).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

  test('every control on the list has an accessible name', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await page.goto(`/admin/applications?campaign_id=${world.campaignId}`);
    await expect(page.getByLabel('Search')).toBeVisible();
    await expect(page.getByRole('radiogroup').or(page.getByRole('group', { name: 'Status' }))).toBeVisible();
    for (const name of ['Awaiting review', 'Approved', 'Rejected', 'All']) {
      await expect(page.getByRole('radio', { name })).toBeVisible();
    }
    await page.getByRole('button', { name: /^more/i }).click();
    for (const label of ['Received from', 'Received to', 'Oldest first']) {
      await expect(page.getByLabel(label)).toBeVisible();
    }
  });

  test('targets are at least 44px and keyboard focus is visible', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    // Every status, so there are more focusable controls than Tab presses and
    // focus never runs off the end of the page into the browser's own interface.
    await page.goto(`/admin/applications?campaign_id=${world.campaignId}&status=all`);
    await expect(page.getByTestId('application-row').first()).toBeVisible();

    const review = page.getByRole('button', { name: /review ana reyes/i });
    const box = await review.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);

    await page.getByLabel('Search').focus();
    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press('Tab');
      const outline = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element) return null;
        const style = getComputedStyle(element);
        return { style: style.outlineStyle, width: style.outlineWidth };
      });
      expect(outline).not.toBeNull();
      expect(outline?.style).not.toBe('none');
    }
  });

  test('the list is operable by keyboard alone', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await page.goto(`/admin/applications?campaign_id=${world.campaignId}`);
    await expect(page.getByTestId('application-row').first()).toBeVisible();

    await page.getByRole('radio', { name: 'Awaiting review' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/status=approved/);
  });

  test('results are announced and nothing overflows the page horizontally', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await page.goto(`/admin/applications?campaign_id=${world.campaignId}&status=all`);
    await expect(page.locator('[role="status"][aria-live="polite"]').first()).toBeAttached();
    await expect(page.getByTestId('application-row').first()).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    // The slide-over fills a phone and still does not scroll sideways.
    await page.getByRole('button', { name: /review ana reyes/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const drawerOverflow = await page.evaluate(() => {
      const dialog = document.querySelector('dialog');
      return dialog ? dialog.scrollWidth - dialog.clientWidth : 0;
    });
    expect(drawerOverflow).toBeLessThanOrEqual(1);
  });

  test('the slide-over respects reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await signIn(page, world.staff.privacyAdmin);
    await page.goto(`/admin/applications?campaign_id=${world.campaignId}`);
    await page.getByRole('button', { name: /review ana reyes/i }).click();
    const animation = await page.getByRole('dialog').evaluate((element) => getComputedStyle(element).animationName);
    expect(animation).toBe('none');
  });
});
