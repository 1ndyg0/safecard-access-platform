/**
 * Isolated-database seed for the review and corrections suite.
 *
 * The suite drives the real protected routes. Its assertions are about
 * database behaviour — session scoping, submission versioning, unique
 * constraints, consent revalidation — so it needs real rows.
 *
 * Safety: this truncates before it inserts. It refuses any target that
 * is not obviously disposable, and the project the application is
 * configured against is on a hard denylist that no environment variable
 * can lift.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const PASSWORD = 'e2e-review-corrections-passphrase';

/**
 * The project named in .codex/config.toml. Seeding it would truncate the
 * database the application actually runs against.
 */
const NEVER_SEED_PROJECT_REFS = ['ajyhlkzbocjeepglkhrl'];

function assertDisposableTarget(url: string): void {
  for (const ref of NEVER_SEED_PROJECT_REFS) {
    if (url.includes(ref)) {
      throw new Error(
        `Refusing to seed project ${ref}. This is the database the application is ` +
          'configured against, and the seed truncates every table. Use a Supabase branch. ' +
          'E2E_ALLOW_REMOTE does not override this.',
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
    throw new Error('E2E_SUPABASE_URL and E2E_SERVICE_ROLE_KEY must point at an isolated database.');
  }
  assertDisposableTarget(url);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

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

export interface SeededCase {
  id: string;
  reference: string;
  mobile: string;
}

export interface SeededWorld {
  admin: SupabaseClient;
  campaignId: string;
  reviewer: { email: string; password: string; userId: string };
  privacyAdmin: { email: string; password: string; userId: string };
  cases: {
    /** pending review, payment not verified */
    pendingReview: SeededCase;
    /** payment verified, review still pending */
    paidPendingReview: SeededCase;
    /** approved + payment verified: handoff-ready, still not a member */
    approvedAndPaid: SeededCase;
    /** resubmission requested, with a reason */
    correctionRequested: SeededCase;
    /** rejected, terminal */
    rejected: SeededCase;
    /** correction requested but consent already withdrawn */
    consentWithdrawn: SeededCase;
    /** correction requested, consent expired by a material content change */
    consentExpired: SeededCase;
    /** a different applicant, for cross-case attempts */
    otherApplicant: SeededCase;
  };
  content: { consentVersionId: string; privacyVersionId: string };
}

async function clear(admin: SupabaseClient): Promise<void> {
  for (const table of TABLES_TO_CLEAR) {
    const { error } = await admin
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`Failed to clear ${table}: ${error.message}`);
  }
}

async function createStaff(admin: SupabaseClient, email: string, fullName: string) {
  let { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  // Guard: if a previous run left the user behind, delete and recreate rather than failing.
  if (error?.message?.includes('already been registered')) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
    const leftover = list?.users.find((u) => u.email === email);
    if (leftover) await admin.auth.admin.deleteUser(leftover.id);
    ({ data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true }));
  }
  if (error || !data.user) throw new Error(`Failed to create ${email}: ${error?.message}`);
  await admin.from('users').upsert({ id: data.user.id, email, full_name: fullName }, { onConflict: 'id' });
  return { email, password: PASSWORD, userId: data.user.id };
}

async function deleteExistingStaff(admin: SupabaseClient): Promise<void> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const user of data?.users ?? []) {
    if (user.email?.endsWith('@e2e.safecard.test')) await admin.auth.admin.deleteUser(user.id);
  }
}

let sequence = 0;
function nextReference(): string {
  sequence += 1;
  return `SC-2026-RV${String(sequence).padStart(6, '0')}`;
}

/**
 * Profiles are written to satisfy the platform's synthetic-data rules:
 * visibly marked names and locations, and the reserved DOB, ZIP, mobile
 * and email values. Anything else is refused by the launch gate, which
 * is the behaviour under test in one of the specs.
 */
export function syntheticProfile(index: number) {
  return {
    first_name: `Test${index}`,
    last_name: 'Synthetic',
    date_of_birth: '2000-01-01',
    sex: 'female',
    address_line1: 'Test Street 1',
    city: 'Test City',
    province: 'Test Province',
    zip_code: '0000',
    mobile_number: '+639000000000',
    email: `member${index}@example.com`,
  };
}

async function insertCase(
  admin: SupabaseClient,
  campaignId: string,
  content: { consentVersionId: string; privacyVersionId: string },
  index: number,
  states: Record<string, string>,
  options: { correctionReason?: string; consentVersionOverride?: string } = {},
): Promise<SeededCase> {
  const id = randomUUID();
  const reference = nextReference();
  const profile = syntheticProfile(index);

  const { error } = await admin.from('recipient_cases').insert({
    id,
    campaign_id: campaignId,
    application_ref: reference,
    consent_state: states.consent_state ?? 'agreed',
    application_state: states.application_state ?? 'submitted',
    application_review_state: states.application_review_state ?? 'pending',
    payment_state: states.payment_state ?? 'not_started',
    prc_handoff_state: states.prc_handoff_state ?? 'not_ready',
    membership_state: states.membership_state ?? 'not_active',
    consent_content_version_id: options.consentVersionOverride ?? content.consentVersionId,
    privacy_notice_version_id: content.privacyVersionId,
  });
  if (error) throw new Error(`Failed to insert case: ${error.message}`);

  await admin.from('recipient_profiles').insert({ case_id: id, ...profile, fields_completed: true });

  const consentId = randomUUID();
  await admin.from('consent_records').insert({
    id: consentId,
    case_id: id,
    consent_content_version_id: content.consentVersionId,
    privacy_notice_version_id: content.privacyVersionId,
    locale: 'tl',
    state: states.consent_state === 'withdrawn' ? 'withdrawn' : 'agreed',
    agreed_at: new Date().toISOString(),
    request_hash: randomUUID(),
  });

  await admin.from('application_submissions').insert({
    case_id: id,
    application_ref: reference,
    submitted_data: profile,
    consent_record_id: consentId,
    content_versions_seen: [content.consentVersionId, content.privacyVersionId],
    privacy_notice_version_id: content.privacyVersionId,
    submitted_at: new Date(Date.now() - 3_600_000).toISOString(),
    correction_reason: options.correctionReason ?? null,
    idempotency_key: randomUUID(),
    request_hash: randomUUID(),
    is_current: true,
  });

  return { id, reference, mobile: profile.mobile_number };
}

export async function seedWorld(): Promise<SeededWorld> {
  const admin = createSeedClient();
  sequence = 0;

  await clear(admin);
  await deleteExistingStaff(admin);

  const organizationId = randomUUID();
  await admin
    .from('organizations')
    .insert({ id: organizationId, name: 'E2E School', organization_type: 'school' });

  const campaignId = randomUUID();
  await admin.from('pilot_campaigns').insert({
    id: campaignId,
    organization_id: organizationId,
    name: 'E2E Review Campaign',
    slug: `e2e-review-${campaignId.slice(0, 8)}`,
    start_date: '2026-01-01',
    max_applications: 1000,
    is_active: true,
    approved_payment_routes: [
      { type: 'gcash', is_active: true },
      { type: 'bank_transfer', is_active: true },
    ],
  });

  const reviewer = await createStaff(admin, 'reviewer@e2e.safecard.test', 'School Reviewer');
  const privacyAdmin = await createStaff(admin, 'privacy@e2e.safecard.test', 'Privacy Admin');

  await admin.from('role_assignments').insert([
    { user_id: reviewer.userId, role: 'school_admin', campaign_id: campaignId, is_active: true },
    {
      user_id: privacyAdmin.userId,
      role: 'privacy_admin_owner',
      campaign_id: campaignId,
      is_active: true,
    },
  ]);

  const consentVersionId = randomUUID();
  const privacyVersionId = randomUUID();
  await admin.from('content_versions').insert([
    {
      id: consentVersionId,
      content_type: 'consent_text',
      locale: 'tl',
      version: 1,
      created_by: privacyAdmin.userId,
      title: 'Consent',
      body: 'Synthetic consent text.',
      approval_status: 'approved',
      is_published: true,
      published_at: new Date(Date.now() - 86_400_000).toISOString(),
    },
    {
      id: privacyVersionId,
      content_type: 'privacy_notice',
      locale: 'tl',
      version: 1,
      created_by: privacyAdmin.userId,
      title: 'Privacy notice',
      body: 'Synthetic privacy notice.',
      approval_status: 'approved',
      is_published: true,
      published_at: new Date(Date.now() - 86_400_000).toISOString(),
    },
  ]);

  const content = { consentVersionId, privacyVersionId };

  const cases = {
    pendingReview: await insertCase(admin, campaignId, content, 1, {}),
    paidPendingReview: await insertCase(admin, campaignId, content, 2, {
      payment_state: 'verified_by_official_source',
    }),
    approvedAndPaid: await insertCase(admin, campaignId, content, 3, {
      application_review_state: 'approved',
      payment_state: 'verified_by_official_source',
      prc_handoff_state: 'ready_for_export',
    }),
    correctionRequested: await insertCase(
      admin,
      campaignId,
      content,
      4,
      {
        application_state: 'correction_needed',
        application_review_state: 'resubmission_requested',
      },
      { correctionReason: 'The birth date does not match the supporting document.' },
    ),
    rejected: await insertCase(admin, campaignId, content, 5, {
      application_review_state: 'rejected',
    }),
    consentWithdrawn: await insertCase(admin, campaignId, content, 6, {
      consent_state: 'withdrawn',
      application_state: 'correction_needed',
      application_review_state: 'resubmission_requested',
    }),
    consentExpired: await insertCase(admin, campaignId, content, 7, {
      consent_state: 'expired_due_to_content_change',
      application_state: 'correction_needed',
      application_review_state: 'resubmission_requested',
    }),
    otherApplicant: await insertCase(admin, campaignId, content, 8, {}),
  };

  // A recorded decision so the correction case carries a reviewer reason.
  await admin.from('application_review_decisions').insert({
    case_id: cases.correctionRequested.id,
    campaign_id: campaignId,
    reviewer_id: reviewer.userId,
    decision: 'resubmission_requested',
    prior_state: 'pending',
    resulting_state: 'resubmission_requested',
    reason: 'The birth date does not match the supporting document.',
    idempotency_key: randomUUID(),
  });

  return { admin, campaignId, reviewer, privacyAdmin, cases, content };
}

/**
 * Publish a newer, materially changed consent version. Used to prove
 * that a correction cannot be submitted under superseded terms.
 */
export async function publishMaterialConsentChange(
  admin: SupabaseClient,
  createdBy: string,
): Promise<string> {
  const id = randomUUID();
  await admin.from('content_versions').insert({
    id,
    content_type: 'consent_text',
    locale: 'tl',
    version: 2,
    created_by: createdBy,
    title: 'Consent v2',
    body: 'Synthetic consent text, materially revised.',
    approval_status: 'approved',
    is_published: true,
    is_material_change: true,
    change_summary: 'The data retention period changed.',
    published_at: new Date().toISOString(),
  });
  return id;
}
