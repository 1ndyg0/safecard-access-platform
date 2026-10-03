import { expect, test } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { seedWorld } from './fixtures/seed';
import { signIn } from './fixtures/auth';

function authenticatorCode(secret: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret.toUpperCase().replace(/=+$/, '')]
    .map((character) => alphabet.indexOf(character).toString(2).padStart(5, '0')).join('');
  const bytes = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac('sha1', bytes).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

test('staff authenticator setup establishes genuine AAL2 assurance', async ({ page }) => {
  const world = await seedWorld();
  await signIn(page, world.staff.finance);
  await page.goto('/admin/account');
  const enrolled = page.waitForResponse((response) =>
    response.url().endsWith('/auth/v1/factors') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Set up authenticator', exact: true }).click();
  const enrollment = await (await enrolled).json();
  // This secret belongs only to a disposable synthetic test account.
  await page.getByLabel('Authenticator code', { exact: true }).fill(authenticatorCode(enrollment.totp.secret));
  await page.getByRole('button', { name: 'Verify authenticator', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Authenticator verified');
  const session = await page.request.get('/api/admin/account');
  expect(session.status()).toBe(200);
  expect((await session.json()).assuranceLevel).toBe('aal2');
});

test('staff set their own password and can sign in with it again', async ({ page }) => {
  const world = await seedWorld();
  await signIn(page, world.staff.finance);
  await page.goto('/admin/account');
  await expect(page.getByText(`Signed in as ${world.staff.finance.email}.`, { exact: false })).toBeVisible();
  const newPassword = 'synthetic-new-individual-password';
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm new password', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Save password', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Your password has been saved');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await signIn(page, { ...world.staff.finance, password: newPassword });
  expect((await page.request.get('/api/admin/account')).status()).toBe(200);
});

test('recovery token establishes a staff session without accepting an external redirect', async ({ page }, testInfo) => {
  const world = await seedWorld();
  const { data, error } = await world.admin.auth.admin.generateLink({
    type: 'recovery', email: world.staff.finance.email,
  });
  expect(error).toBeNull();
  expect(data?.properties?.hashed_token).toBeTruthy();
  await page.goto(`/auth/confirm?type=recovery&token_hash=${data!.properties!.hashed_token}&next=https://example.invalid`);
  await expect(page).toHaveURL(new URL('/admin/account', testInfo.project.use.baseURL).toString());
  const account = await page.request.get('/api/admin/account');
  expect(account.status(), await account.text()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Set your password' })).toBeVisible();
  const recoveredPassword = 'synthetic-recovered-individual-password';
  await page.getByLabel('New password', { exact: true }).fill(recoveredPassword);
  await page.getByLabel('Confirm new password', { exact: true }).fill(recoveredPassword);
  await page.getByRole('button', { name: 'Save password', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Your password has been saved');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await signIn(page, { ...world.staff.finance, password: recoveredPassword });
  expect((await page.request.get('/api/admin/account')).status()).toBe(200);
});

test('unassigned users cannot open staff account setup', async ({ page }) => {
  const world = await seedWorld();
  await signIn(page, world.staff.unassigned);
  expect((await page.request.get('/api/admin/account')).status()).toBe(403);
  await page.goto('/admin/account');
  await expect(page.getByRole('heading', { name: 'Set your password' })).toHaveCount(0);
});
