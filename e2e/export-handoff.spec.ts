import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { seedWorld, type SeededWorld } from './fixtures/seed';
import { signIn } from './fixtures/auth';

let world: SeededWorld;

test.beforeEach(async () => {
  world = await seedWorld();
});

async function insertExportItem(worldState: SeededWorld) {
  const { data: submission } = await worldState.admin
    .from('application_submissions')
    .select('id,submitted_data')
    .eq('case_id', worldState.cases.handoffReady)
    .eq('is_current', true)
    .single();
  if (!submission) throw new Error('Seeded current submission is missing');

  const batchId = randomUUID();
  const { error: batchError } = await worldState.admin.from('prc_export_batches').insert({
    id: batchId,
    campaign_id: worldState.campaignId,
    batch_ref: `EXP-2026-${batchId.slice(0, 10).toUpperCase()}`,
    created_by: worldState.staff.privacyAdmin.userId,
    creation_reason: 'E2E verification of controlled PRC reconciliation.',
    reauth_method: 'mfa',
    reauth_at: new Date().toISOString(),
    record_count: 1,
    column_order: ['application_ref'],
    checksum: 'b'.repeat(64),
    format: 'json',
  });
  if (batchError) throw new Error(batchError.message);

  const itemId = randomUUID();
  const { error: itemError } = await worldState.admin.from('prc_export_items').insert({
    id: itemId,
    batch_id: batchId,
    case_id: worldState.cases.handoffReady,
    submission_id: submission.id,
    export_order: 0,
    prc_status: 'pending',
    original_values: submission.submitted_data,
  });
  if (itemError) throw new Error(itemError.message);
  await worldState.admin
    .from('recipient_cases')
    .update({ prc_handoff_state: 'exported', membership_state: 'pending_prc_confirmation' })
    .eq('id', worldState.cases.handoffReady);
  return itemId;
}

test.describe('PRC export and reconciliation', () => {
  test('shows only eligible campaign cases and requires AAL2 to export', async ({ page }) => {
    await signIn(page, world.staff.finance);
    const consoleResponse = await page.request.get(
      `/api/export/console?campaign_id=${world.campaignId}`,
    );
    expect(consoleResponse.ok()).toBe(true);
    const consoleData = await consoleResponse.json();
    expect(consoleData.eligibleCases.map((item: { id: string }) => item.id)).toEqual([
      world.cases.handoffReady,
    ]);

    const exportResponse = await page.request.post('/api/export/batch', {
      data: {
        campaign_id: world.campaignId,
        creation_reason: 'Controlled E2E export attempt without step-up authentication.',
        case_ids: [world.cases.handoffReady],
        format: 'json',
      },
    });
    expect(exportResponse.status()).toBe(403);
    expect((await exportResponse.json()).error).toContain('MFA');
  });

  test('PRC correction returns the case to correction without activating membership', async ({ page }) => {
    const itemId = await insertExportItem(world);
    await signIn(page, world.staff.prcLiaison);
    const reason = 'Please correct the date of birth to match the submitted identity record.';
    const response = await page.request.post('/api/export/acknowledge', {
      data: {
        export_item_id: itemId,
        prc_status: 'correction_requested',
        correction_reason: reason,
        correction_fields: { date_of_birth: true },
      },
    });
    expect(response.ok()).toBe(true);

    const { data: caseRow } = await world.admin
      .from('recipient_cases')
      .select('application_state,application_review_state,prc_handoff_state,membership_state')
      .eq('id', world.cases.handoffReady)
      .single();
    expect(caseRow).toMatchObject({
      application_state: 'correction_needed',
      application_review_state: 'resubmission_requested',
      prc_handoff_state: 'correction_requested',
      membership_state: 'not_active',
    });
  });

  test('only an accepted PRC response activates membership', async ({ page }) => {
    const itemId = await insertExportItem(world);
    await signIn(page, world.staff.prcLiaison);
    const response = await page.request.post('/api/export/acknowledge', {
      data: {
        export_item_id: itemId,
        prc_status: 'accepted',
        prc_membership_id: 'PRC-E2E-0001',
        prc_effective_date: '2026-09-09',
        prc_expiry_date: '2027-09-08',
      },
    });
    expect(response.ok()).toBe(true);

    const { data: caseRow } = await world.admin
      .from('recipient_cases')
      .select('prc_handoff_state,membership_state')
      .eq('id', world.cases.handoffReady)
      .single();
    expect(caseRow).toMatchObject({
      prc_handoff_state: 'accepted',
      membership_state: 'active_confirmed',
    });
  });
});
