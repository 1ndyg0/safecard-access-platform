import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { seedWorld, type SeededWorld } from './fixtures/review-seed';
import { signInMember } from './fixtures/review-auth';

let world: SeededWorld;

test.beforeEach(async () => {
  world = await seedWorld();
});

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
}

/** Switch the stored preference, which is the app's own locale mechanism. */
async function useLocale(page: Page, locale: 'fil' | 'en') {
  await page.addInitScript(
    (value) => window.localStorage.setItem('safecard-locale', value),
    locale,
  );
}

test.describe('member accessibility', () => {
  for (const locale of ['fil', 'en'] as const) {
    test(`status page has no serious violations in ${locale}`, async ({ page }) => {
      await useLocale(page, locale);
      await signInMember(page, world.cases.correctionRequested);
      await page.goto('/member/status');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });

    test(`correction form has no serious violations in ${locale}`, async ({ page }) => {
      await useLocale(page, locale);
      await signInMember(page, world.cases.correctionRequested);
      await page.goto('/member/correction');
      await expect(page.getByRole('checkbox')).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  test('every correction input has an associated label', async ({ page }) => {
    await signInMember(page, world.cases.correctionRequested);
    await page.goto('/member/correction');
    await expect(page.getByRole('checkbox')).toBeVisible();

    const unlabelled = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('input, select, textarea')).filter((element) => {
          const id = element.getAttribute('id');
          if (element.getAttribute('aria-label')) return false;
          if (!id) return true;
          return !document.querySelector(`label[for="${CSS.escape(id)}"]`);
        }).length,
    );
    expect(unlabelled).toBe(0);
  });

  test('keyboard focus stays visible while tabbing the form', async ({ page }) => {
    await signInMember(page, world.cases.correctionRequested);
    await page.goto('/member/correction');
    await expect(page.getByRole('checkbox')).toBeVisible();
    await page.keyboard.press('Tab');

    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press('Tab');
      const outlineStyle = await page.evaluate(() => {
        const element = document.activeElement;
        return element ? getComputedStyle(element).outlineStyle : null;
      });
      expect(outlineStyle).not.toBe('none');
    }
  });

  test('submission errors are announced', async ({ page }) => {
    await signInMember(page, world.cases.correctionRequested);
    await page.goto('/member/correction');
    await page.getByRole('checkbox').check();
    // Clear a required field so validation fires.
    await page.getByLabel(/apelyido|last name/i).fill('');
    await page.getByRole('button', { name: /isumite|submit/i }).click();

    await expect(page.locator('[role="alert"]').first()).toBeAttached();
    await expect(page.locator('.field-error').first()).toBeVisible();
  });

  test('a blocked correction is explained in a live region', async ({ page }) => {
    await signInMember(page, world.cases.pendingReview);
    await page.goto('/member/correction');
    await expect(page.locator('[role="status"], .notice-panel').first()).toBeVisible();
  });

  test('narrow layouts do not scroll horizontally', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await signInMember(page, world.cases.correctionRequested);
    await page.goto('/member/correction');
    await expect(page.getByRole('checkbox')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('long translated content still fits', async ({ page }) => {
    await useLocale(page, 'fil');
    await page.setViewportSize({ width: 320, height: 720 });
    await signInMember(page, world.cases.rejected);
    await page.goto('/member/status');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('the submit control meets a 44px touch target', async ({ page }) => {
    await signInMember(page, world.cases.correctionRequested);
    await page.goto('/member/correction');
    const button = await page.getByRole('button', { name: /isumite|submit/i }).boundingBox();
    expect(button?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
