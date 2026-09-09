import { expect, type Page } from '@playwright/test';
import type { SeededStaff } from './seed';

/**
 * Sign in through the real login form.
 *
 * The session cookie is issued by Supabase and read back by the Route
 * Handlers, so authorization in these specs is the production path and
 * not a fixture that assumes a role.
 */
export async function signIn(page: Page, staff: SeededStaff): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(staff.email);
  await page.getByLabel('Password').fill(staff.password);
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await page.waitForURL(/\/admin(\?.*)?$/);
}

export async function signInAndOpenQueue(
  page: Page,
  staff: SeededStaff,
  campaignId: string,
  query = '',
): Promise<void> {
  await signIn(page, staff);
  const suffix = query ? `&${query}` : '';
  await page.goto(`/admin/submissions?campaign_id=${campaignId}${suffix}`);
  await expect(page.getByRole('heading', { name: 'Submissions' })).toBeVisible();
}

/** Read the reference column of the queue, in displayed order. */
export async function queueReferences(page: Page): Promise<string[]> {
  await expect(page.locator('table.admin-table tbody tr').first()).toBeVisible();
  return page.locator('table.admin-table tbody tr td:first-child a').allInnerTexts();
}
