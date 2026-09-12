/**
 * Isolated-database seed for the operations console E2E suite.
 *
 * The suite drives real Route Handlers against a real PostgreSQL
 * database, because that is where this module's risk lives: campaign
 * scoping, role projection, five enum types and SQL-side suppression.
 * None of it is observable through an intercepted route.
 *
 * Safety: the seed refuses to run against anything that does not look
 * like a disposable database, and it truncates before it inserts.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const PASSWORD = 'e2e-operations-console-passphrase';

export interface SeededStaff {
  email: string;
  password: string;
  userId: string;
}

export interface SeededWorld {
  admin: SupabaseClient;
  campaignId: string;
  otherCampaignId: string;
  staff: {
    privacyAdmin: SeededStaff;
    finance: SeededStaff;
    support: SeededStaff;
    schoolAdmin: SeededStaff;
    prcLiaison: SeededStaff;
    /** Holds a role, but only on the other campaign. */
    outsider: SeededStaff;
    /** Authenticates but holds no active role at all. */
    unassigned: SeededStaff;
  };
  cases: {
    approvedUnverifiedPayment: string;
    verifiedPaymentPendingReview: string;
    handoffReady: string;
    correctionRequested: string;
    longestWaiting: string;
    recentlyResubmitted: string;
    /** Belongs to otherCampaignId. */
    crossCampaign: string;
  };
  paymentIntentId: string;
  paymentEvidenceId: string;
}

/**
 * Project refs that must never be seeded, whatever the environment says.
 *
 * This seed truncates every table listed in TABLES_TO_CLEAR. Pointing it
 * at the project the application is actually wired to would destroy that
 * data with no prompt and no undo. The ref below is the one named in
 * .codex/config.toml, so it is exactly the value someone is most likely
 * to paste in while trying to get the suite running.
 *
 * E2E_ALLOW_REMOTE deliberately does NOT override this list.
 */
const NEVER_SEED_PROJECT_REFS = ['ajyhlkzbocjeepglkhrl'];

/**
 * Refuse to seed anything that is not obviously disposable.
 *
 * Truncating tables is not something to do against a URL that merely
 * happens to be configured. A hosted project must opt in explicitly by
 * setting E2E_ALLOW_REMOTE=1, and only for a branch database.
 */
function assertDisposableTarget(url: string): void {
  for (const ref of NEVER_SEED_PROJECT_REFS) {
    if (url.includes(ref)) {
      throw new Error(
        `Refusing to seed project ${ref}. This is the database the application is ` +
          'configured against, and the seed truncates every table. Create a Supabase ' +
          'branch and point E2E_SUPABASE_URL at that instead. E2E_ALLOW_REMOTE does ' +
          'not override this.',
      );
    }
  }

  const isLocal =
    url.includes('127.0.0.1') || url.includes('localhost') || url.includes('kong:8000');
  if (isLocal) return;
  if (process.env.E2E_ALLOW_REMOTE === '1') return;
  throw new Error(
    `Refusing to seed ${url}. Point E2E_SUPABASE_URL at a local Supabase stack, or set ` +
      'E2E_ALLOW_REMOTE=1 for a disposable branch database. Never a shared project.',
  );
}

export function createSeedClient(): SupabaseClient {
  const url = process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.E2E_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'E2E_SUPABASE_URL and E2E_SERVICE_ROLE_KEY must be set to an isolated database.',
    );
  }
  assertDisposableTarget(url);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Order matters: children before parents. */
const TABLES_TO_CLEAR = [
  'storyboard_events',
  'audit_events',
  'notification_events',
  'jobs',
  'rate_limit_buckets',
  'aggregate_metrics',
  'application_review_decisions',
  'payment_evidence_versions',
  'payment_evidence',
  'payment_intents',
  'membership_status_events',
  'prc_export_items',
  'prc_export_batches',
  'application_submissions',
  'support_cases',
  'relationships',
  'recipient_profiles',
  'consent_records',
  'recipient_cases',
  'content_versions',
  'referral_links',
  'sponsors',
  'role_assignments',
  'pilot_campaigns',
  'organizations',
] as const;

async function clear(admin: SupabaseClient): Promise<void> {
  for (const table of TABLES_TO_CLEAR) {
    const { error } = await admin
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`Failed to clear ${table}: ${error.message}`);
  }
}

async function createStaff(
  admin: SupabaseClient,
  email: string,
  fullName: string,
): Promise<SeededStaff> {
  // Look up any leftover from a previous run BEFORE calling createUser. This avoids relying on
  // deleteExistingStaff having fully propagated through GoTrue: if a FK constraint from
  // public.users blocked the auth deletion, or GoTrue hasn't yet reflected it, we would get a
  // false "already registered" error on createUser and then fail to find the user in a
  // post-error listUsers call (because GoTrue may have soft-deleted or tombstoned it). By
  // checking first we always have a stable view of whether the user exists.
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = list?.users.find((u) => u.email === email);

  if (existing) {
    // User left over from a previous run — reset password in-place and sync profile row.
    await admin.auth.admin.updateUserById(existing.id, { password: PASSWORD });
    const { error: profileError } = await admin
      .from('users')
      .upsert({ id: existing.id, email, full_name: fullName }, { onConflict: 'id' });
    if (profileError) throw new Error(`Failed to upsert user row: ${profileError.message}`);
    return { email, password: PASSWORD, userId: existing.id };
  }

  // No existing user — create fresh.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Failed to create ${email}: ${error?.message}`);

  const { error: profileError } = await admin
    .from('users')
    .upsert({ id: data.user.id, email, full_name: fullName }, { onConflict: 'id' });
  if (profileError) throw new Error(`Failed to upsert user row: ${profileError.message}`);

  return { email, password: PASSWORD, userId: data.user.id };
}

async function deleteExistingStaff(admin: SupabaseClient): Promise<void> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const user of data?.users ?? []) {
    if (user.email?.endsWith('@e2e.safecard.test')) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }
}

/**
 * Insert a case with explicit, independent workflow states.
 * `submittedAt` drives the review-wait clock.
 */
async function insertCase(
  admin: SupabaseClient,
  campaignId: string,
  states: {
    consent_state?: string;
    application_state?: string;
    application_review_state?: string;
    payment_state?: string;
    prc_handoff_state?: string;
    membership_state?: string;
  },
  options: {
    applicationRef?: string;
    submittedAt?: string;
    createdAt?: string;
    isResubmission?: boolean;
    correctionReason?: string;
  } = {},
): Promise<string> {
  const caseId = randomUUID();
  const versionId = await contentVersionId(admin);
  const { error } = await admin.from('recipient_cases').insert({
    id: caseId,
    campaign_id: campaignId,
    application_ref: options.applicationRef ?? null,
    consent_state: states.consent_state ?? 'agreed',
    application_state: states.application_state ?? 'draft',
    application_review_state: states.application_review_state ?? 'pending',
    payment_state: states.payment_state ?? 'not_started',
    prc_handoff_state: states.prc_handoff_state ?? 'not_ready',
    membership_state: states.membership_state ?? 'not_active',
    consent_content_version_id: versionId,
    privacy_notice_version_id: versionId,
    created_at: options.createdAt ?? new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to insert case: ${error.message}`);

  if (options.submittedAt && options.applicationRef) {
    const original = options.isResubmission ? randomUUID() : null;
    if (original) {
      await admin.from('application_submissions').insert({
        id: original,
        case_id: caseId,
        application_ref: options.applicationRef,
        submitted_data: {},
        consent_record_id: await consentRecordFor(admin, caseId),
        content_versions_seen: [versionId],
        privacy_notice_version_id: versionId,
        submitted_at: new Date(Date.now() - 20 * 86_400_000).toISOString(),
        idempotency_key: randomUUID(),
        request_hash: randomUUID(),
        is_current: false,
      });
    }
    const { error: submissionError } = await admin.from('application_submissions').insert({
      case_id: caseId,
      application_ref: options.applicationRef,
      submitted_data: {},
      consent_record_id: await consentRecordFor(admin, caseId),
      content_versions_seen: [versionId],
      privacy_notice_version_id: versionId,
      submitted_at: options.submittedAt,
      original_submission_id: original,
      correction_reason: options.correctionReason ?? null,
      idempotency_key: randomUUID(),
      request_hash: randomUUID(),
      is_current: true,
    });
    if (submissionError) {
      throw new Error(`Failed to insert submission: ${submissionError.message}`);
    }
  }

  // Minimal profile so role projection has something to withhold.
  await admin.from('recipient_profiles').insert({
    case_id: caseId,
    first_name: 'Synthetic',
    last_name: `Case-${caseId.slice(0, 4)}`,
    date_of_birth: '2000-01-01',
    sex: 'female',
    address_line1: '1 Synthetic Street',
    city: 'Test City',
    province: 'Test Province',
    zip_code: '0000',
    mobile_number: '+639000000000',
    email: `case-${caseId.slice(0, 8)}@e2e.safecard.test`,
    fields_completed: true,
  });

  return caseId;
}

let cachedContentVersionId: string | null = null;
let contentCreatedBy: string | null = null;
async function contentVersionId(admin: SupabaseClient): Promise<string> {
  if (cachedContentVersionId) return cachedContentVersionId;
  if (!contentCreatedBy) throw new Error('Content seed owner is not initialized');
  const id = randomUUID();
  const { error } = await admin.from('content_versions').insert({
    id,
    content_type: 'privacy_notice',
    locale: 'en',
    version: 1,
    created_by: contentCreatedBy,
    title: 'Synthetic privacy notice',
    body: 'Synthetic privacy notice for tests.',
    approval_status: 'approved',
    is_published: true,
    published_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to insert content version: ${error.message}`);
  cachedContentVersionId = id;
  return id;
}

const consentByCase = new Map<string, string>();
async function consentRecordFor(admin: SupabaseClient, caseId: string): Promise<string> {
  const existing = consentByCase.get(caseId);
  if (existing) return existing;
  const id = randomUUID();
  const { error } = await admin.from('consent_records').insert({
    id,
    case_id: caseId,
    consent_content_version_id: await contentVersionId(admin),
    privacy_notice_version_id: await contentVersionId(admin),
    locale: 'en',
    state: 'agreed',
    agreed_at: new Date().toISOString(),
    request_hash: randomUUID(),
  });
  if (error) throw new Error(`Failed to insert consent: ${error.message}`);
  consentByCase.set(caseId, id);
  return id;
}

export async function seedWorld(): Promise<SeededWorld> {
  const admin = createSeedClient();
  cachedContentVersionId = null;
  contentCreatedBy = null;
  consentByCase.clear();

  await clear(admin);
  await deleteExistingStaff(admin);

  const organizationId = randomUUID();
  const otherOrganizationId = randomUUID();
  await admin
    .from('organizations')
    .insert([
      { id: organizationId, name: 'E2E School', organization_type: 'school' },
      { id: otherOrganizationId, name: 'E2E Other School', organization_type: 'school' },
    ]);

  const campaignId = randomUUID();
  const otherCampaignId = randomUUID();
  await admin.from('pilot_campaigns').insert([
    {
      id: campaignId,
      organization_id: organizationId,
      name: 'E2E Primary Campaign',
      slug: `e2e-primary-${campaignId.slice(0, 8)}`,
      start_date: '2026-01-01',
      max_applications: 1000,
      is_active: true,
      approved_payment_routes: [
        { type: 'gcash', is_active: true },
        { type: 'bank_transfer', is_active: true },
      ],
    },
    {
      id: otherCampaignId,
      organization_id: otherOrganizationId,
      name: 'E2E Other Campaign',
      slug: `e2e-other-${otherCampaignId.slice(0, 8)}`,
      start_date: '2026-01-01',
      max_applications: 1000,
      is_active: true,
      approved_payment_routes: [
        { type: 'gcash', is_active: true },
        { type: 'bank_transfer', is_active: true },
      ],
    },
  ]);

  const staff = {
    privacyAdmin: await createStaff(admin, 'privacy@e2e.safecard.test', 'Privacy Admin'),
    finance: await createStaff(admin, 'finance@e2e.safecard.test', 'Finance Reviewer'),
    support: await createStaff(admin, 'support@e2e.safecard.test', 'Support Agent'),
    schoolAdmin: await createStaff(admin, 'school@e2e.safecard.test', 'School Admin'),
    prcLiaison: await createStaff(admin, 'prc@e2e.safecard.test', 'PRC Liaison'),
    outsider: await createStaff(admin, 'outsider@e2e.safecard.test', 'Other Campaign Staff'),
    unassigned: await createStaff(admin, 'unassigned@e2e.safecard.test', 'No Role'),
  };
  contentCreatedBy = staff.privacyAdmin.userId;

  await admin.from('role_assignments').insert([
    { user_id: staff.privacyAdmin.userId, role: 'privacy_admin_owner', campaign_id: campaignId, is_active: true },
    { user_id: staff.finance.userId, role: 'finance_export', campaign_id: campaignId, is_active: true },
    { user_id: staff.support.userId, role: 'support_agent', campaign_id: campaignId, is_active: true },
    { user_id: staff.schoolAdmin.userId, role: 'school_admin', campaign_id: campaignId, is_active: true },
    { user_id: staff.prcLiaison.userId, role: 'prc_liaison', campaign_id: campaignId, is_active: true },
    { user_id: staff.outsider.userId, role: 'school_admin', campaign_id: otherCampaignId, is_active: true },
  ]);

  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

  const cases = {
    // Application approved in substance but payment not verified: proves
    // the two are independent and that neither activates membership.
    approvedUnverifiedPayment: await insertCase(
      admin,
      campaignId,
      {
        application_state: 'submitted',
        payment_state: 'payer_marked_paid',
        prc_handoff_state: 'not_ready',
        membership_state: 'not_active',
      },
      { applicationRef: 'SC-2026-AAAA0001', submittedAt: hoursAgo(6) },
    ),
    verifiedPaymentPendingReview: await insertCase(
      admin,
      campaignId,
      {
        application_state: 'submitted',
        payment_state: 'verified_by_official_source',
        prc_handoff_state: 'not_ready',
        membership_state: 'not_active',
      },
      { applicationRef: 'SC-2026-AAAA0002', submittedAt: hoursAgo(40) },
    ),
    handoffReady: await insertCase(
      admin,
      campaignId,
      {
        application_state: 'submitted',
        application_review_state: 'approved',
        payment_state: 'verified_by_official_source',
        prc_handoff_state: 'ready_for_export',
        membership_state: 'not_active',
      },
      { applicationRef: 'SC-2026-AAAA0003', submittedAt: hoursAgo(50) },
    ),
    correctionRequested: await insertCase(
      admin,
      campaignId,
      { application_state: 'correction_needed', payment_state: 'not_started' },
      {
        applicationRef: 'SC-2026-AAAA0004',
        submittedAt: hoursAgo(100),
        correctionReason: 'The birth date does not match the supporting document.',
      },
    ),
    // Created long ago, still waiting: must lead longest-waiting order.
    longestWaiting: await insertCase(
      admin,
      campaignId,
      { application_state: 'submitted' },
      {
        applicationRef: 'SC-2026-AAAA0005',
        submittedAt: hoursAgo(200),
        createdAt: hoursAgo(400),
      },
    ),
    // Created even earlier but resubmitted an hour ago: must NOT lead,
    // because its review wait restarted at the resubmission.
    recentlyResubmitted: await insertCase(
      admin,
      campaignId,
      { application_state: 'resubmitted' },
      {
        applicationRef: 'SC-2026-AAAA0006',
        submittedAt: hoursAgo(1),
        createdAt: hoursAgo(900),
        isResubmission: true,
      },
    ),
    crossCampaign: await insertCase(
      admin,
      otherCampaignId,
      { application_state: 'submitted' },
      { applicationRef: 'SC-2026-BBBB0001', submittedAt: hoursAgo(5) },
    ),
  };

  // One payment intent with evidence, for the finance actions.
  const paymentIntentId = randomUUID();
  const { error: intentError } = await admin.from('payment_intents').insert({
    id: paymentIntentId,
    case_id: cases.approvedUnverifiedPayment,
    campaign_id: campaignId,
    payer_type: 'other',
    expected_amount: 1200,
    currency: 'PHP',
    payment_route: 'approved-route',
    state: 'verification_pending',
    request_hash: randomUUID(),
  });
  if (intentError) throw new Error(`Failed to insert intent: ${intentError.message}`);

  const parentEvidenceId = randomUUID();
  const paymentEvidenceId = randomUUID();
  const { error: evidenceError } = await admin.from('payment_evidence').insert({
    id: parentEvidenceId,
    payment_intent_id: paymentIntentId,
    evidence_type: 'manual_receipt_reference',
    reference_number: 'E2E-RECEIPT-0001',
    amount_confirmed: 1200,
    source: 'applicant_upload',
    is_verified: false,
  });
  if (evidenceError) throw new Error(`Failed to insert evidence: ${evidenceError.message}`);

  const { error: versionError } = await admin.from('payment_evidence_versions').insert({
    id: paymentEvidenceId,
    payment_evidence_id: parentEvidenceId,
    payment_intent_id: paymentIntentId,
    version_number: 1,
    object_path: `campaigns/${campaignId}/cases/${cases.approvedUnverifiedPayment}/payments/${paymentIntentId}/evidence/${paymentEvidenceId}.png`,
    content_type: 'image/png',
    file_size_bytes: 24,
    sha256: 'a'.repeat(64),
    image_width: 1,
    image_height: 1,
    state: 'verification_pending',
    uploaded_by: staff.finance.userId,
  });
  if (versionError) throw new Error(`Failed to insert evidence version: ${versionError.message}`);

  await admin
    .from('recipient_cases')
    .update({ payment_state: 'verification_pending' })
    .eq('id', cases.approvedUnverifiedPayment);

  return {
    admin,
    campaignId,
    otherCampaignId,
    staff,
    cases,
    paymentIntentId,
    paymentEvidenceId,
  };
}

/**
 * Add `count` submitted cases to a campaign, for cohort-size tests.
 * Used to walk the suppression boundary from four to five.
 */
export async function addSubmittedCases(
  admin: SupabaseClient,
  campaignId: string,
  count: number,
): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await insertCase(
      admin,
      campaignId,
      { application_state: 'submitted', payment_state: 'verified_by_official_source' },
      {
        applicationRef: `SC-2026-COHORT${String(index).padStart(2, '0')}`,
        submittedAt: new Date(Date.now() - 3_600_000).toISOString(),
      },
    );
  }
}
