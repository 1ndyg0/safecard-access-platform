/**
 * Isolated-database seed for the operations console E2E suite.
 *
 * The suite drives real Route Handlers against a real PostgreSQL
 * database, because that is where this module's risk lives: campaign
 * scoping, role projection, enum typing and the SQL view that decides
 * which applications are complete. None of it is observable through an
 * intercepted route.
 *
 * Safety: the seed refuses to run against anything that does not look
 * like a disposable database, and it truncates before it inserts.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { resetSyntheticDatabase } from './reset';

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
    support: SeededStaff;
    schoolAdmin: SeededStaff;
    /** Holds a role, but only on the other campaign. */
    outsider: SeededStaff;
    /** Authenticates but holds no active role at all. */
    unassigned: SeededStaff;
  };
  cases: {
    /** Complete and awaiting review, with proof of payment: the approve scenario. */
    awaitingApproval: string;
    /** Complete and awaiting review, with proof of payment: the reject scenario. */
    awaitingRejection: string;
    /** Complete and awaiting review, with proof of payment: UI scenarios. */
    awaitingSpare: string;
    /** Approved, payment verified. */
    approved: string;
    /** Rejected, with a reason the applicant can read. */
    rejected: string;
    /** In progress: details not submitted. Must never reach the administrator. */
    incompleteDraft: string;
    /** In progress: details submitted but no proof of payment. Must never reach the administrator. */
    incompleteNoProof: string;
    /** Retired "correction requested" workflow. Must never reach the administrator. */
    legacyCorrection: string;
    /** Belongs to otherCampaignId. */
    crossCampaign: string;
  };
  /** Payment intent and proof for every case that has one, keyed by case id. */
  payments: Record<string, { intentId: string; evidenceId: string }>;
  /** Applicant name and mobile number seeded for a case. */
  applicants: Record<string, { name: string; mobile: string; reference: string }>;
  /** Payment of the approve scenario (kept for tests that exercise the payment functions). */
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
    ['127.0.0.1', 'localhost', 'kong'].includes(new URL(url).hostname);
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
  'application_submissions',
  'support_cases',
  'recipient_profiles',
  'consent_records',
  'recipient_cases',
  'content_versions',
  'role_assignments',
  'pilot_campaigns',
  'organizations',
] as const;

async function clear(): Promise<void> {
  await resetSyntheticDatabase(TABLES_TO_CLEAR);

}

async function createStaff(
  admin: SupabaseClient,
  email: string,
  fullName: string,
): Promise<SeededStaff> {
  // resetSyntheticDatabase() (called from clear()) hard-deletes @e2e.safecard.test rows from
  // auth.users and auth.identities via SQL, so on a well-formed reset there is no leftover.
  // The lookup-first branch is a safety net for any environment that reused this fixture
  // without our reset — it treats an existing auth user as a password reset rather than an
  // "already registered" error.
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
    membership_state?: string;
  },
  options: {
    applicationRef?: string;
    submittedAt?: string;
    createdAt?: string;
    isResubmission?: boolean;
    correctionReason?: string;
    firstName?: string;
    lastName?: string;
    mobile?: string;
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
    first_name: options.firstName ?? 'Synthetic',
    last_name: options.lastName ?? `Case-${caseId.slice(0, 4)}`,
    date_of_birth: '2000-01-01',
    sex: 'female',
    address_line1: '1 Synthetic Street',
    city: 'Test City',
    province: 'Test Province',
    zip_code: '0000',
    mobile_number: options.mobile ?? '+639000000000',
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

  // clear() also hard-deletes any @e2e.safecard.test rows from auth.users and auth.identities
  // via SQL (see resetSyntheticDatabase). We deliberately do not call GoTrue's admin
  // deleteUser() here because it soft-deletes: the user disappears from listUsers() but the
  // identity mapping survives, so a subsequent createUser() would fail with "already registered"
  // with no recovery path.
  await clear();

  const organizationId = randomUUID();
  const otherOrganizationId = randomUUID();
  await admin
    .from('organizations')
    .insert([
      { id: organizationId, name: 'E2E School', slug: `e2e-school-${organizationId}`, org_type: 'school' },
      { id: otherOrganizationId, name: 'E2E Other School', slug: `e2e-school-${otherOrganizationId}`, org_type: 'school' },
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
    support: await createStaff(admin, 'support@e2e.safecard.test', 'Support Agent'),
    schoolAdmin: await createStaff(admin, 'school@e2e.safecard.test', 'School Admin'),
    outsider: await createStaff(admin, 'outsider@e2e.safecard.test', 'Other Campaign Staff'),
    unassigned: await createStaff(admin, 'unassigned@e2e.safecard.test', 'No Role'),
  };
  contentCreatedBy = staff.privacyAdmin.userId;

  await admin.from('role_assignments').insert([
    { user_id: staff.privacyAdmin.userId, role: 'privacy_admin_owner', campaign_id: campaignId, is_active: true },
    { user_id: staff.support.userId, role: 'support_agent', campaign_id: campaignId, is_active: true },
    { user_id: staff.schoolAdmin.userId, role: 'school_admin', campaign_id: campaignId, is_active: true },
    { user_id: staff.outsider.userId, role: 'school_admin', campaign_id: otherCampaignId, is_active: true },
  ]);

  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

  const applicants: SeededWorld['applicants'] = {};
  const complete = { application_state: 'submitted', payment_state: 'verification_pending' };
  const person = async (
    states: Parameters<typeof insertCase>[2],
    reference: string,
    hours: number,
    firstName: string,
    lastName: string,
    mobile: string,
    targetCampaign = campaignId,
  ): Promise<string> => {
    const id = await insertCase(admin, targetCampaign, states, {
      applicationRef: reference,
      submittedAt: hoursAgo(hours),
      firstName,
      lastName,
      mobile,
    });
    applicants[id] = { name: `${firstName} ${lastName}`, mobile, reference };
    return id;
  };

  const cases = {
    awaitingApproval: await person(complete, 'SC-2026-AAAA0001', 6, 'Ana', 'Reyes', '09171110001'),
    awaitingRejection: await person(complete, 'SC-2026-AAAA0002', 30, 'Ben', 'Santos', '09171110002'),
    awaitingSpare: await person(complete, 'SC-2026-AAAA0003', 70, 'Cara', 'Lim', '09171110003'),
    approved: await person(
      { ...complete, application_review_state: 'approved', payment_state: 'verified_by_official_source' },
      'SC-2026-AAAA0004', 50, 'Dina', 'Cruz', '09171110004',
    ),
    rejected: await person(
      { ...complete, application_review_state: 'rejected' },
      'SC-2026-AAAA0005', 90, 'Eli', 'Tan', '09171110005',
    ),
    incompleteDraft: await person(
      { application_state: 'draft', payment_state: 'not_started' },
      'SC-2026-AAAA0006', 3, 'Fay', 'Garcia', '09171110006',
    ),
    incompleteNoProof: await person(
      { application_state: 'submitted', payment_state: 'payer_marked_paid' },
      'SC-2026-AAAA0007', 4, 'Gio', 'Lopez', '09171110007',
    ),
    legacyCorrection: await person(
      { application_state: 'correction_needed', payment_state: 'verification_pending' },
      'SC-2026-AAAA0008', 100, 'Hana', 'Ocampo', '09171110008',
    ),
    crossCampaign: await person(complete, 'SC-2026-BBBB0001', 5, 'Ivan', 'Dela Cruz', '09171110009', otherCampaignId),
  };

  // Proof of payment for every complete application.
  const payments: SeededWorld['payments'] = {};
  for (const key of ['awaitingApproval', 'awaitingRejection', 'awaitingSpare', 'approved', 'rejected', 'legacyCorrection'] as const) {
    payments[cases[key]] = await addPaymentProof(admin, {
      campaignId,
      caseId: cases[key],
      uploadedBy: staff.privacyAdmin.userId,
      verified: key === 'approved',
      reference: `E2E-RECEIPT-${applicants[cases[key]].reference.slice(-4)}`,
    });
  }
  payments[cases.crossCampaign] = await addPaymentProof(admin, {
    campaignId: otherCampaignId,
    caseId: cases.crossCampaign,
    uploadedBy: staff.privacyAdmin.userId,
    verified: false,
    reference: 'E2E-RECEIPT-BBBB',
  });

  // The rejection lives in the append-only ledger; the database copies the
  // reason, reviewer and time onto the case.
  const { error: ledgerError } = await admin.from('application_review_decisions').insert({
    case_id: cases.rejected,
    campaign_id: campaignId,
    reviewer_id: staff.privacyAdmin.userId,
    decision: 'rejected',
    prior_state: 'pending',
    resulting_state: 'rejected',
    reason: 'The receipt amount does not match the membership fee.',
    idempotency_key: randomUUID(),
  });
  if (ledgerError) throw new Error(`Failed to insert rejection: ${ledgerError.message}`);

  return {
    admin,
    campaignId,
    otherCampaignId,
    staff,
    cases,
    payments,
    applicants,
    paymentIntentId: payments[cases.awaitingApproval].intentId,
    paymentEvidenceId: payments[cases.awaitingApproval].evidenceId,
  };
}

/**
 * A payment intent with an uploaded proof for a case, as the applicant's final
 * step leaves it: payment `verification_pending`, one evidence version.
 */
async function addPaymentProof(
  admin: SupabaseClient,
  options: { campaignId: string; caseId: string; uploadedBy: string; verified: boolean; reference: string },
): Promise<{ intentId: string; evidenceId: string }> {
  const intentId = randomUUID();
  const state = options.verified ? 'verified_by_official_source' : 'verification_pending';
  const { error: intentError } = await admin.from('payment_intents').insert({
    id: intentId,
    case_id: options.caseId,
    campaign_id: options.campaignId,
    payer_type: 'other',
    expected_amount: 1200,
    currency: 'PHP',
    payment_route: 'gcash',
    payment_reference: options.reference,
    payer_reported_paid_on: '2026-09-15',
    payer_reported_amount: 1200,
    state,
    request_hash: randomUUID(),
  });
  if (intentError) throw new Error(`Failed to insert intent: ${intentError.message}`);

  const parentEvidenceId = randomUUID();
  const evidenceId = randomUUID();
  const { error: evidenceError } = await admin.from('payment_evidence').insert({
    id: parentEvidenceId,
    payment_intent_id: intentId,
    evidence_type: 'manual_receipt_reference',
    reference_number: options.reference,
    amount_confirmed: 1200,
    source: 'applicant_upload',
    is_verified: options.verified,
  });
  if (evidenceError) throw new Error(`Failed to insert evidence: ${evidenceError.message}`);

  const proofBytes = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const proofPath = `campaigns/${options.campaignId}/cases/${options.caseId}/payments/${intentId}/evidence/${evidenceId}.png`;
  const stored = await admin.storage.from('payment-proofs').upload(proofPath, proofBytes, { contentType: 'image/png', upsert: false });
  if (stored.error) throw new Error('Could not store the synthetic receipt fixture.');

  const { error: versionError } = await admin.from('payment_evidence_versions').insert({
    id: evidenceId,
    payment_evidence_id: parentEvidenceId,
    payment_intent_id: intentId,
    version_number: 1,
    object_path: proofPath,
    content_type: 'image/png',
    file_size_bytes: proofBytes.length,
    sha256: createHash('sha256').update(proofBytes).digest('hex'),
    image_width: 1,
    image_height: 1,
    state: options.verified ? 'verified' : 'verification_pending',
    uploaded_by: options.uploadedBy,
  });
  if (versionError) throw new Error(`Failed to insert evidence version: ${versionError.message}`);

  return { intentId, evidenceId };
}

/**
 * Add `count` complete applications (details submitted, proof of payment
 * uploaded) to a campaign, for the scale checks.
 */
export async function addCompleteApplications(
  admin: SupabaseClient,
  campaignId: string,
  count: number,
): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await insertCase(
      admin,
      campaignId,
      { application_state: 'submitted', payment_state: 'verification_pending' },
      {
        applicationRef: `SC-2026-${randomUUID().slice(0, 8).toUpperCase()}`,
        submittedAt: new Date(Date.now() - 3_600_000).toISOString(),
      },
    );
  }
}
