import { expect, type Page } from '@playwright/test';
import type { SeededCase } from './seed';

/** Sign in through the real staff form, so the session is the real one. */
export async function signInStaff(
  page: Page,
  staff: { email: string; password: string },
): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(staff.email);
  await page.getByLabel('Password').fill(staff.password);
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await page.waitForURL(/\/admin(\?.*)?$/);
}

/**
 * Sign in as a member with reference plus registered mobile.
 * No OTP: SMS is parked, and these specs must not reintroduce it.
 */
export async function signInMember(page: Page, seeded: SeededCase): Promise<void> {
  const response = await page.request.post('/api/member/auth', {
    data: { referenceNumber: seeded.reference, mobileNumber: seeded.mobile },
  });
  expect(response.ok(), 'member sign-in should succeed').toBe(true);
}

/** Replace the member cookie with an expired token. */
export async function expireMemberSession(page: Page): Promise<void> {
  const context = page.context();
  const cookies = await context.cookies();
  const member = cookies.find((cookie) => cookie.name === 'sc_member_session');
  if (!member) throw new Error('No member session cookie to expire.');
  await context.clearCookies();
  await context.addCookies([{ ...member, expires: Math.floor(Date.now() / 1000) - 60 }]);
}
