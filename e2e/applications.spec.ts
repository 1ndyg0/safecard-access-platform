import { expect, test } from '@playwright/test';
import { seedWorld, type SeededWorld } from './fixtures/seed';
import { listedReferences, signIn, signInAndOpenApplications } from './fixtures/auth';

let world: SeededWorld;

test.beforeAll(async () => {
  world = await seedWorld();
});

const AWAITING = ['SC-2026-AAAA0001', 'SC-2026-AAAA0002', 'SC-2026-AAAA0003'];
const COMPLETE = [...AWAITING, 'SC-2026-AAAA0004', 'SC-2026-AAAA0005'];

function url(path = '') {
  return `/api/admin/cases?campaign_id=${world.campaignId}${path}`;
}

test.describe('applications list API', () => {
  test('only complete applications are ever listed', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const body = await (await page.request.get(url('&limit=100'))).json();
    const refs: string[] = body.applications.map((row: { application_ref: string }) => row.application_ref);

    expect([...refs].sort()).toEqual(COMPLETE);
    // In progress (draft, no proof of payment), the retired correction
    // workflow, and another campaign never reach the administrator.
    for (const hidden of ['SC-2026-AAAA0006', 'SC-2026-AAAA0007', 'SC-2026-AAAA0008', 'SC-2026-BBBB0001']) {
      expect(refs).not.toContain(hidden);
    }
  });

  test('filters by the three statuses', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const refsFor = async (status: string) => {
      const body = await (await page.request.get(url(`&status=${status}`))).json();
      return body.applications.map((row: { application_ref: string }) => row.application_ref).sort();
    };
    expect(await refsFor('awaiting_review')).toEqual(AWAITING);
    expect(await refsFor('approved')).toEqual(['SC-2026-AAAA0004']);
    expect(await refsFor('rejected')).toEqual(['SC-2026-AAAA0005']);
    expect(await refsFor('all')).toEqual(COMPLETE);
  });

  test('rejects a status that belongs to the retired workflow filters', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    expect((await page.request.get(url('&status=verification_pending'))).status()).toBe(400);
    expect((await page.request.get(url('&status=correction_needed'))).status()).toBe(400);
  });

  test('one search box finds by name, mobile number and reference', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const search = async (term: string) =>
      (await (await page.request.get(url(`&status=all&search=${encodeURIComponent(term)}`))).json()).applications.map(
        (row: { application_ref: string }) => row.application_ref,
      );

    expect(await search('Reyes')).toEqual(['SC-2026-AAAA0001']);
    expect(await search('ana reyes')).toEqual(['SC-2026-AAAA0001']);
    expect(await search('09171110002')).toEqual(['SC-2026-AAAA0002']);
    expect(await search('+639171110002')).toEqual(['SC-2026-AAAA0002']);
    expect(await search('sc-2026-aaaa0003')).toEqual(['SC-2026-AAAA0003']);
    expect(await search('nobody-by-this-name')).toEqual([]);
    // Wildcards are not search syntax.
    expect(await search('%%')).toEqual([]);
  });

  test('a role without name or mobile access neither sees nor searches them', async ({ page }) => {
    await signIn(page, world.staff.schoolAdmin);
    const body = await (await page.request.get(url('&status=all'))).json();
    expect(body.applications.length).toBeGreaterThan(0);
    // The school administrator role reads identity fields but not contact fields.
    for (const row of body.applications) expect(row.mobile_number).toBeNull();
    const byMobile = await (await page.request.get(url('&status=all&search=09171110002'))).json();
    expect(byMobile.applications).toEqual([]);
  });

  test('newest first by default and oldest first on request', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const newest = await (await page.request.get(url('&status=all'))).json();
    const oldest = await (await page.request.get(url('&status=all&sort=oldest'))).json();
    expect(newest.applications[0].application_ref).toBe('SC-2026-AAAA0001');
    expect(oldest.applications[0].application_ref).toBe('SC-2026-AAAA0005');
  });

  test('the date range includes the whole of the closing day', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    // The day comes from a seeded row, not the clock: seeded rows are hours old, so
    // "today" in UTC holds none of them when the suite runs in the first hours after midnight UTC.
    const all = await (await page.request.get(url('&status=all'))).json();
    const closingDay = String(all.applications[0].received_at).slice(0, 10);
    const inclusive = await (await page.request.get(url(`&status=all&from=${closingDay}&to=${closingDay}`))).json();
    expect(inclusive.pagination.total).toBeGreaterThan(0);
    const future = await (await page.request.get(url('&status=all&from=2099-01-01&to=2099-01-02'))).json();
    expect(future.pagination.total).toBe(0);
  });

  test('paginates on the server without repeating or dropping a row', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const first = await (await page.request.get(url('&status=all&limit=2&page=1'))).json();
    const second = await (await page.request.get(url('&status=all&limit=2&page=2'))).json();
    expect(first.applications).toHaveLength(2);
    const firstIds = first.applications.map((row: { id: string }) => row.id);
    const secondIds = second.applications.map((row: { id: string }) => row.id);
    expect(firstIds.some((id: string) => secondIds.includes(id))).toBe(false);
    expect(first.pagination.total).toBe(5);
  });

  test('denies a list request for another campaign', async ({ page }) => {
    await signIn(page, world.staff.outsider);
    expect((await page.request.get(url())).status()).toBe(403);
  });

  test('denies staff with no active role', async ({ page }) => {
    await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email').fill(world.staff.unassigned.email);
    await page.getByLabel('Password').fill(world.staff.unassigned.password);
    const auditResponse = page.waitForResponse(
      (response) => response.url().includes('/api/admin/session/audit'),
      { timeout: 15_000 },
    );
    await page.getByRole('button', { name: /sign in securely/i }).click();
    expect((await auditResponse).status()).toBe(403);
    await expect(page.getByText(/sign-in failed.*account assignment/i)).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
    expect((await page.request.get(url())).status()).toBe(401);
  });
});

test.describe('dashboard', () => {
  test('shows only the three counts and a way into the list', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await expect(page.getByTestId('count-awaiting_review')).toHaveText('3');
    await expect(page.getByTestId('count-approved')).toHaveText('1');
    await expect(page.getByTestId('count-rejected')).toHaveText('1');
    await expect(page.getByTestId('count-total')).toHaveText('5');

    // The old analytics and operational-count sections are gone.
    await expect(page.getByText(/operational counts|review aging|conversion|throughput/i)).toHaveCount(0);

    await page.getByRole('link', { name: /review applications/i }).click();
    await expect(page).toHaveURL(/\/admin\/applications\?status=awaiting_review/);
    expect([...(await listedReferences(page))].sort()).toEqual(AWAITING);
  });

  test('the overview API returns four numbers and no application rows', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const body = await (await page.request.get(`/api/admin/overview?campaign_id=${world.campaignId}`)).json();
    expect(body.counts).toEqual({ awaiting_review: 3, approved: 1, rejected: 1, total: 5 });
    expect(JSON.stringify(body)).not.toContain('SC-2026-');
  });
});

test.describe('applications screen', () => {
  test('defaults to awaiting review and filters with the status control', async ({ page }) => {
    await signInAndOpenApplications(page, world.staff.privacyAdmin, world.campaignId);
    expect([...(await listedReferences(page))].sort()).toEqual(AWAITING);

    // The list reloads after each change, so wait for the new rows rather than
    // reading the ones still on screen.
    await page.getByRole('radio', { name: 'Approved' }).check();
    await expect(page).toHaveURL(/status=approved/);
    await expect.poll(() => listedReferences(page)).toEqual(['SC-2026-AAAA0004']);

    await page.getByRole('radio', { name: 'All' }).check();
    await expect.poll(async () => [...(await listedReferences(page))].sort()).toEqual(COMPLETE);
  });

  test('the old filters are gone', async ({ page }) => {
    await signInAndOpenApplications(page, world.staff.privacyAdmin, world.campaignId);
    for (const label of ['Consent', 'Application', 'Payment', 'Membership', 'Application review', 'Sort']) {
      await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
    }
    for (const column of ['Consent', 'Membership', 'PRC handoff']) {
      await expect(page.getByRole('columnheader', { name: column })).toHaveCount(0);
    }
    for (const column of ['Applicant', 'Application ref', 'Mobile', 'Received', 'Payment proof', 'Status']) {
      await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
    }
  });

  test('searches from one box and keeps the view in the URL', async ({ page }) => {
    await signInAndOpenApplications(page, world.staff.privacyAdmin, world.campaignId, 'status=all');
    await page.getByLabel('Search').fill('Santos');
    // Typing is debounced and the list then reloads.
    await expect.poll(() => listedReferences(page)).toEqual(['SC-2026-AAAA0002']);
    await expect(page).toHaveURL(/search=Santos/);

    await page.reload();
    await expect.poll(() => listedReferences(page)).toEqual(['SC-2026-AAAA0002']);
  });

  test('the reference is plain text, not a link', async ({ page }) => {
    await signInAndOpenApplications(page, world.staff.privacyAdmin, world.campaignId);
    await expect(page.getByTestId('application-row').first()).toBeVisible();
    await expect(page.locator('table a')).toHaveCount(0);
  });

  test('shows an empty state rather than a blank table', async ({ page }) => {
    await signInAndOpenApplications(page, world.staff.privacyAdmin, world.campaignId, 'status=all&search=zzzzzz');
    await expect(page.getByTestId('apps-empty')).toBeVisible();
  });

  test('the old queue address redirects to the applications list', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await page.goto('/admin/submissions');
    await expect(page).toHaveURL(/\/admin\/applications/);
  });

  test('retired console pages and APIs are gone', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    for (const path of ['/admin/users', `/admin/submissions/${world.cases.awaitingApproval}`, `/admin/cases/${world.cases.awaitingApproval}`]) {
      expect((await page.goto(path))?.status(), path).toBe(404);
    }
    const id = world.cases.awaitingApproval;
    for (const path of [
      '/api/admin/analytics',
      '/api/admin/users',
      '/api/admin/roles/list',
      `/api/admin/cases/${id}/audit`,
      `/api/admin/cases/${id}/review`,
      `/api/admin/cases/${id}/correction`,
      `/api/admin/cases/${id}/request-payment-proof`,
    ]) {
      expect((await page.request.get(path)).status(), path).toBe(404);
    }
  });
});
