import { expect, test } from '@playwright/test';
import { seedWorld, type SeededWorld } from './fixtures/seed';
import { signIn } from './fixtures/auth';

let world: SeededWorld;

test.beforeEach(async () => {
  world = await seedWorld();
});

test.describe('staff role management', () => {
  test('campaign metadata cannot authorize sibling-campaign receipt access', async ({ page }) => {
    const { data: campaign, error } = await world.admin.from('pilot_campaigns')
      .select('organization_id').eq('id', world.campaignId).single();
    expect(error).toBeNull();
    const sibling = await world.admin.from('pilot_campaigns')
      .update({ organization_id: campaign!.organization_id }).eq('id', world.otherCampaignId);
    expect(sibling.error).toBeNull();
    const assignment = await world.admin.from('role_assignments')
      .update({ organization_id: campaign!.organization_id }).eq('user_id', world.staff.outsider.userId);
    expect(assignment.error).toBeNull();
    await signIn(page, world.staff.outsider);
    const response = await page.request.post('/api/payment/evidence/request-reupload', {
      data: { evidence_version_id: world.paymentEvidenceId, reason: 'Synthetic cross-campaign access attempt.' },
    });
    expect(response.status()).toBe(403);
    const { data: unchanged } = await world.admin.from('payment_evidence_versions')
      .select('state').eq('id', world.paymentEvidenceId).single();
    expect(unchanged?.state).toBe('verification_pending');
  });

  test('assigns and revokes one campaign role with an audit trail', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const reason = 'Temporary applicant support coverage for the current pilot.';
    const assigned = await page.request.post('/api/admin/roles/assign', {
      data: {
        user_id: world.staff.unassigned.userId,
        role: 'support_agent',
        campaign_id: world.campaignId,
        reason,
      },
    });
    expect(assigned.status()).toBe(201);
    const assignment = await assigned.json();
    expect(assignment.status).toBe('assigned');

    const replay = await page.request.post('/api/admin/roles/assign', {
      data: {
        user_id: world.staff.unassigned.userId,
        role: 'support_agent',
        campaign_id: world.campaignId,
        reason,
      },
    });
    expect((await replay.json()).status).toBe('already_assigned');

    const revoked = await page.request.post('/api/admin/roles/revoke', {
      data: {
        role_assignment_id: assignment.roleAssignmentId,
        reason: 'Temporary pilot support coverage has now ended.',
      },
    });
    expect(revoked.ok()).toBe(true);

    const { data: row } = await world.admin
      .from('role_assignments')
      .select('is_active,revoked_by,reason')
      .eq('id', assignment.roleAssignmentId)
      .single();
    expect(row?.is_active).toBe(false);
    expect(row?.revoked_by).toBe(world.staff.privacyAdmin.userId);

    const { data: audit } = await world.admin
      .from('audit_events')
      .select('action,details')
      .eq('target_id', assignment.roleAssignmentId)
      .order('created_at');
    expect(audit?.map((item) => item.action)).toEqual([
      'Assigned staff role support_agent',
      'Revoked staff role support_agent',
    ]);
  });

  test('prevents a school admin from granting a privileged PRC role', async ({ page }) => {
    await signIn(page, world.staff.schoolAdmin);
    const response = await page.request.post('/api/admin/roles/assign', {
      data: {
        user_id: world.staff.unassigned.userId,
        role: 'prc_liaison',
        campaign_id: world.campaignId,
        reason: 'Requested liaison coverage for the current pilot.',
      },
    });
    expect(response.status()).toBe(403);
  });

  test('does not allow an administrator to revoke their own role', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const { data: assignment } = await world.admin
      .from('role_assignments')
      .select('id')
      .eq('user_id', world.staff.privacyAdmin.userId)
      .eq('campaign_id', world.campaignId)
      .single();
    const response = await page.request.post('/api/admin/roles/revoke', {
      data: {
        role_assignment_id: assignment?.id,
        reason: 'Attempted self-revocation must be refused safely.',
      },
    });
    expect(response.status()).toBe(403);
  });

  test('renders effective assignments on the campaign staff page', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await page.goto(`/admin/users?campaign_id=${world.campaignId}`);
    await expect(page.getByRole('heading', { name: 'Staff and roles' })).toBeVisible();
    await expect(page.getByText('Finance Reviewer', { exact: true })).toBeVisible();
    await expect(page.getByText('PRC Liaison', { exact: true })).toBeVisible();
  });
});
