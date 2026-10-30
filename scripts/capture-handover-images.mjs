#!/usr/bin/env node
/**
 * Takes the screenshots used in docs/handover.
 *
 * It needs a running production build in safe synthetic mode (see
 * docs/handover/03-technical-handover.md, "Run it on your computer") and
 * answers every API call with clearly fake sample data, so nothing here can
 * touch a real database or a real applicant.
 *
 *   BASE_URL=http://127.0.0.1:3102 node scripts/capture-handover-images.mjs
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3102';
const OUT = new URL('../docs/handover/images/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const SIZES = { desktop: { width: 1280, height: 800 }, tall: { width: 1280, height: 1400 }, phone: { width: 390, height: 844 } };

/** A fake receipt, drawn as an image so the review screen has something to show. */
const RECEIPT = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="520" height="640" viewBox="0 0 520 640"><rect width="520" height="640" fill="#fff"/><rect x="0" y="0" width="520" height="86" fill="#0b6fd6"/><text x="30" y="55" font-family="Arial" font-size="30" font-weight="700" fill="#fff">Payment successful</text><text x="30" y="150" font-family="Arial" font-size="20" fill="#333">Sent to</text><text x="30" y="184" font-family="Arial" font-size="26" font-weight="700" fill="#111">SAMPLE RECEIPT</text><text x="30" y="250" font-family="Arial" font-size="20" fill="#333">Amount</text><text x="30" y="292" font-family="Arial" font-size="34" font-weight="700" fill="#111">PHP 1,200.00</text><text x="30" y="360" font-family="Arial" font-size="20" fill="#333">Reference no.</text><text x="30" y="394" font-family="Arial" font-size="24" fill="#111">SAMPLE-0000-0001</text><text x="30" y="560" font-family="Arial" font-size="18" fill="#a00">Fake image for the handover pictures</text></svg>`)}`;

async function shot(context, name, size, fn) {
  const page = await context.newPage();
  await page.setViewportSize(SIZES[size]);
  await fn(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: false });
  console.log('saved', name);
  await page.close();
}

async function newContext(opts = {}) {
  const context = await browser.newContext({ colorScheme: 'light', serviceWorkers: 'block', ...opts });
  await context.addInitScript(() => window.localStorage.setItem('safecard-locale', 'en'));
  return context;
}

// ── Public pages ──────────────────────────────────────────────────────────
{
  const context = await newContext();
  await shot(context, '01-landing-desktop', 'desktop', (p) => p.goto(`${BASE}/`));
  await shot(context, '02-landing-phone', 'phone', (p) => p.goto(`${BASE}/`));
  await shot(context, '03-benefits-desktop', 'desktop', (p) => p.goto(`${BASE}/benefits`));
  await shot(context, '04-help-desktop', 'desktop', (p) => p.goto(`${BASE}/help`));
  await shot(context, '05-member-login', 'desktop', (p) => p.goto(`${BASE}/member`));
  await shot(context, '06-admin-login', 'desktop', (p) => p.goto(`${BASE}/admin/login`));
  await context.close();
}

// ── The application, step by step, with every call answered by a fake ─────
{
  const context = await newContext();
  const page = await context.newPage();
  await page.setViewportSize(SIZES.desktop);
  await page.route('**/api/pilot/config', (route) => route.fulfill({
    json: {
      mode: 'live', launchGatesComplete: true,
      campaign: { id: '11111111-1111-4111-8111-111111111111', membership_fee: 1200 },
      content: ['tl', 'en'].flatMap((locale) => [
        { id: `00000000-0000-4000-8000-0000000000${locale === 'tl' ? '1' : '2'}1`, content_type: 'consent_text', locale, title: 'Consent', body: 'Consent' },
        { id: `00000000-0000-4000-8000-0000000000${locale === 'tl' ? '1' : '2'}2`, content_type: 'privacy_notice', locale, title: 'Privacy', body: 'Privacy' },
      ]),
      payment: { available: true, reason: null },
      externalNotifications: { available: false, reason: 'Parked' },
    },
  }));
  await page.route('**/api/payment-config**', (route) => route.fulfill({
    json: { available: true, reason: null, amount: 1200, currency: 'PHP', accountName: 'SafeCard', routes: [{ id: 'bank', label: 'Bank transfer', instructions: 'Transfer, then upload the receipt.', bank: 'Sample Bank', accountNumber: '0000' }] },
  }));
  const snap = async (name) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}${name}.png` }); console.log('saved', name); };

  await page.goto(`${BASE}/apply`);
  await page.getByRole('heading', { name: /know what matters/i }).waitFor();
  await snap('10-apply-1-learn');
  await page.getByRole('button', { name: /check my understanding/i }).click();
  await page.getByLabel('₱1,200 per year').check();
  await snap('11-apply-2-quiz');
  const answers = ['₱1,200 per year', 'My application and payment proof are reviewed first', 'The Philippine Red Cross', 'I can cancel at any time and my application is discarded', 'Call the PRC Hotline 143'];
  for (const [index, answer] of answers.entries()) {
    await page.getByLabel(answer).check();
    const last = index === answers.length - 1;
    const following = last ? page.getByRole('button', { name: /continue to your decision/i }) : page.getByLabel(answers[index + 1]);
    for (let tries = 0; tries < 6 && !(await following.isVisible()); tries += 1) {
      await page.getByRole('button', { name: last ? /finish the check/i : /next question/i }).click().catch(() => {});
      await page.waitForTimeout(300);
    }
  }
  await page.getByRole('button', { name: /continue to your decision/i }).click();
  await snap('12-apply-3-decision');
  await page.getByRole('button', { name: /^apply continue/i }).click();
  await snap('13-apply-4-consent');
  for (const box of await page.getByRole('checkbox').all()) await box.check();
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.getByLabel(/first name/i).fill('Ana');
  await page.getByLabel(/last name/i).fill('Sample');
  await page.getByLabel(/date of birth/i).fill('1990-05-04');
  await page.getByLabel(/^sex/i).selectOption('female');
  await page.getByLabel(/mobile number/i).fill('09170000000');
  await page.getByLabel(/^address/i).fill('1 Sample Street');
  await page.getByLabel(/city/i).fill('Manila');
  await page.getByLabel(/province/i).fill('NCR');
  await page.getByLabel(/zip code/i).fill('1000');
  await snap('14-apply-5-details');
  await page.getByRole('button', { name: /next: pay and submit/i }).click();
  await page.getByRole('heading', { name: /review, pay, and submit/i }).waitFor();
  await page.setViewportSize(SIZES.tall);
  await snap('15-apply-6-pay');
  await context.close();
}

// ── Member screens (fake member) ──────────────────────────────────────────
{
  const context = await newContext();
  const status = (review, payment, nextAction) => ({
    reference: 'SC-2026-SAMPLE01',
    states: { application_state: 'submitted', application_review_state: review, payment_state: payment, updated_at: '2026-11-20T02:00:00Z' },
    review: { state: review, reason: null, correctionRequested: false, rejected: false },
    payment: { replacementRequested: false, reason: null },
    nextAction,
  });
  await shot(context, '20-member-status-waiting', 'desktop', async (p) => {
    await p.route('**/api/member/status', (r) => r.fulfill({ json: status('pending', 'verification_pending', 'Wait for review') }));
    await p.goto(`${BASE}/member/status`);
  });
  await shot(context, '21-member-status-approved', 'desktop', async (p) => {
    await p.route('**/api/member/status', (r) => r.fulfill({ json: status('approved', 'verified', 'View your card') }));
    await p.goto(`${BASE}/member/status`);
  });
  await shot(context, '22-member-card', 'desktop', async (p) => {
    await p.route('**/api/member/card', (r) => r.fulfill({ json: { approved: true, reference: 'SC-2026-SAMPLE01', name: 'ANA SAMPLE', mobileMasked: '0917•••0000', location: 'MANILA, NCR', approvedAt: '2026-11-22T03:00:00Z', benefits: [] } }));
    await p.goto(`${BASE}/member/card`);
  });
  await context.close();
}

// ── Administrator screens (fake data) ─────────────────────────────────────
{
  const context = await newContext();
  const rows = [
    ['a1', 'SC-2026-SAMPLE01', 'awaiting_review', 'Ana Sample', '0917 000 0001', '2026-11-20T02:10:00Z'],
    ['a2', 'SC-2026-SAMPLE02', 'awaiting_review', 'Ben Example', '0917 000 0002', '2026-11-20T04:45:00Z'],
    ['a3', 'SC-2026-SAMPLE03', 'awaiting_review', 'Carla Demo', '0917 000 0003', '2026-11-21T01:05:00Z'],
  ].map(([id, ref, st, name, mobile, at]) => ({ id, application_ref: ref, status: st, applicant_name: name, mobile_number: mobile, received_at: at, has_payment_proof: true, rejection_reason: null }));
  const mockAdmin = async (p) => {
    await p.route('**/api/admin/overview**', (r) => r.fulfill({ json: { user: { full_name: 'Sample Administrator', email: 'admin@example.com' }, campaigns: [{ id: 'c1', name: 'Safe Card Pilot 2026', is_active: true }], selectedCampaignId: 'c1', counts: { awaiting_review: 3, approved: 12, rejected: 2, total: 17 } } }));
    await p.route('**/api/admin/cases?**', (r) => r.fulfill({ json: { applications: rows, pagination: { page: 1, limit: 25, total: 3, totalPages: 1 } } }));
    await p.route('**/api/admin/cases/a1', (r) => r.fulfill({ json: {
      application: { id: 'a1', application_ref: 'SC-2026-SAMPLE01', status: 'awaiting_review', review_state: 'pending', received_at: '2026-11-20T02:10:00Z', rejection_reason: null, reviewed_at: null },
      applicant: { first_name: 'Ana', last_name: 'Sample', date_of_birth: '1990-05-04', sex: 'female', mobile_number: '0917 000 0001', email: 'ana@example.com', address_line1: '1 Sample Street', city: 'Manila', province: 'NCR', zip_code: '1000' },
      payment: { intent_id: 'p1', state: 'verification_pending', route: 'gcash', reference: 'SAMPLE-0000-0001', amount: 1200, currency: 'PHP', paid_on: '2026-11-20', proof: { evidence_id: 'e1', content_type: 'image/png', uploaded_at: '2026-11-20T02:09:00Z', verified: false } },
      capabilities: { canDecide: true, canApprove: true, profileFields: ['first_name', 'last_name', 'date_of_birth', 'sex', 'mobile_number', 'email', 'address'] },
    } }));
    await p.route('**/api/payment/evidence/e1', (r) => r.fulfill({ json: { signedUrl: RECEIPT } }));
  };
  await shot(context, '30-admin-dashboard', 'desktop', async (p) => { await mockAdmin(p); await p.goto(`${BASE}/admin`); });
  await shot(context, '31-admin-applications', 'desktop', async (p) => { await mockAdmin(p); await p.goto(`${BASE}/admin/applications`); await p.getByRole('button', { name: /review ana sample/i }).waitFor(); });
  await shot(context, '32-admin-review', 'tall', async (p) => {
    await mockAdmin(p);
    await p.goto(`${BASE}/admin/applications`);
    await p.getByRole('button', { name: /review ana sample/i }).click();
    await p.getByRole('dialog').getByAltText('Uploaded proof of payment').waitFor();
  });
  await shot(context, '33-admin-approve-confirm', 'desktop', async (p) => {
    await mockAdmin(p);
    await p.goto(`${BASE}/admin/applications`);
    await p.getByRole('button', { name: /review ana sample/i }).click();
    await p.getByRole('dialog').getByAltText('Uploaded proof of payment').waitFor();
    await p.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
  });
  await shot(context, '34-admin-reject-reason', 'desktop', async (p) => {
    await mockAdmin(p);
    await p.goto(`${BASE}/admin/applications`);
    await p.getByRole('button', { name: /review ana sample/i }).click();
    await p.getByRole('dialog').getByAltText('Uploaded proof of payment').waitFor();
    await p.getByRole('dialog').getByRole('button', { name: 'Reject' }).click();
  });
  await context.close();
}

// ── Christmas mode (always on) ────────────────────────────────────────────
{
  const context = await newContext();
  await shot(context, '40-christmas-landing', 'desktop', (p) => p.goto(`${BASE}/`));
  await shot(context, '41-christmas-band', 'desktop', async (p) => {
    await p.goto(`${BASE}/`);
    await p.evaluate(() => window.scrollTo(0, document.querySelector('[data-testid="xmas-band"]').getBoundingClientRect().top + scrollY - 20));
  });
  await shot(context, '42-christmas-card-maker', 'tall', async (p) => {
    await p.goto(`${BASE}/gift/card`);
    await p.getByLabel(/your name/i).fill('Ana');
    await p.getByLabel(/their name/i).fill('Lola Nena');
  });
  await shot(context, '43-christmas-landing-phone', 'phone', (p) => p.goto(`${BASE}/`));
  await context.close();
}

await browser.close();
