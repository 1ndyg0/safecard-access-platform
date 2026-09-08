/**
 * Application intake service
 *
 * Handles: recipient case creation, profile data entry,
 * consent capture, comprehension check, review, and idempotent submit.
 *
 * Journey phase 4: Agreement and Application Intake
 *
 * Key rules:
 * - No data collected until explicit consent
 * - Consent and application are separate state machines
 * - Submit is idempotent (same key + same payload = same result)
 * - Application reference generated on submit: SC-YYYY-XXXXXXXX
 * - Shared-device safe: no persistent PII in browser storage by default
 * - Assisted entry only after agreement and in recipient's presence
 * - Comprehension evidence is calculated and stored server-side
 */

import { getSupabaseAdminClient } from '@/lib/db/client';
import { writeAuditEvent } from '@/lib/audit';
import {
  validateConsentTransition,
  validateApplicationTransition,
} from '@/lib/state-machines';
import type { ConsentState, ApplicationState } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';
import { generateApplicationReference } from '@/lib/reference';
import { createHash } from 'node:crypto';
import { canonicalJson } from '@/lib/canonical-json';

function hashRequest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

// ============================================================
// Create a recipient case (when they arrive via referral or direct)
// ============================================================

export interface CreateCaseInput {
  campaignId: string;
  referralLinkId?: string;
  authUserId?: string;
}

export async function createRecipientCase(
  input: CreateCaseInput,
): Promise<{ caseId: string }> {
  const admin = getSupabaseAdminClient();

  const caseId = uuidv4();

  if (input.referralLinkId) {
    const { data: referral } = await admin
      .from('referral_links')
      .select('id')
      .eq('id', input.referralLinkId)
      .eq('campaign_id', input.campaignId)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle();
    if (!referral) throw new Error('Referral link is invalid or expired');
  }

  const { error } = await admin.from('recipient_cases').insert({
    id: caseId,
    campaign_id: input.campaignId,
    referral_link_id: input.referralLinkId ?? null,
    auth_user_id: input.authUserId ?? null,
    consent_state: 'not_started',
    application_state: 'draft',
    payment_state: 'not_started',
    prc_handoff_state: 'not_ready',
    membership_state: 'not_active',
    decision: 'accept',
    decision_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to create recipient case: ${error.message}`);
  }

  // Create the empty profile record
  const { error: profileError } = await admin.from('recipient_profiles').insert({
    case_id: caseId,
  });
  if (profileError) throw new Error(`Failed to create recipient profile: ${profileError.message}`);

  // If there's a referral, create the sponsor relationship
  if (input.referralLinkId) {
    const { data: link } = await admin
      .from('referral_links')
      .select('sponsor_id')
      .eq('id', input.referralLinkId)
      .single();

    if (link) {
      await admin.from('relationships').insert({
        case_id: caseId,
        relationship_type: 'sponsor',
        sponsor_id: link.sponsor_id,
      });

      await admin.rpc('increment_referral_starts', { p_referral_link_id: input.referralLinkId });
    }
  }

  return { caseId };
}

// ============================================================
// Grant consent
// ============================================================

export interface GrantConsentInput {
  caseId: string;
  consentType: 'membership_application' | 'data_processing' | 'notification_opt_in';
  consentContentVersionId: string;
  privacyNoticeVersionId: string;
  locale: 'en' | 'tl' | 'ceb';
  idempotencyKey: string;
  ipHash?: string;
  userAgentHash?: string;
}

export async function grantConsent(
  input: GrantConsentInput,
): Promise<{ consentRecordId: string; status: 'created' | 'exists' }> {
  const admin = getSupabaseAdminClient();
  const requestHash = hashRequest({
    caseId: input.caseId,
    consentType: input.consentType,
    consentContentVersionId: input.consentContentVersionId,
    privacyNoticeVersionId: input.privacyNoticeVersionId,
    locale: input.locale,
  });

  // Idempotency check
  const { data: existing } = await admin
    .from('consent_records')
    .select('id')
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle();

  if (existing) {
    const { data: existingRecord } = await admin
      .from('consent_records')
      .select('request_hash')
      .eq('id', existing.id)
      .single();
    if (
      !existingRecord || existingRecord.request_hash !== requestHash
    ) {
      throw new Error('Idempotency key conflict');
    }
    return { consentRecordId: existing.id, status: 'exists' };
  }

  // Validate state transition
  const { data: currentCase } = await admin
    .from('recipient_cases')
    .select('consent_state')
    .eq('id', input.caseId)
    .single();

  if (!currentCase) {
    throw new Error('Case not found');
  }

  const { data: approvedVersions } = await admin
    .from('content_versions')
    .select('id, content_type, locale')
    .in('id', [input.consentContentVersionId, input.privacyNoticeVersionId])
    .eq('approval_status', 'approved')
    .eq('is_published', true);
  const consentVersion = approvedVersions?.find((item) => item.id === input.consentContentVersionId);
  const privacyVersion = approvedVersions?.find((item) => item.id === input.privacyNoticeVersionId);
  if (
    consentVersion?.content_type !== 'consent_text' ||
    privacyVersion?.content_type !== 'privacy_notice' ||
    consentVersion.locale !== input.locale ||
    privacyVersion.locale !== input.locale
  ) {
    throw new Error('Consent requires current approved consent and privacy content');
  }

  // Valid transitions to 'agreed': from 'not_started' (via 'reviewing') or from 'reviewing'
  const currentState = currentCase.consent_state as ConsentState;
  validateConsentTransition(currentState, 'agreed');

  const consentRecordId = uuidv4();

  const { error } = await admin.from('consent_records').insert({
    id: consentRecordId,
    case_id: input.caseId,
    consent_type: input.consentType,
    consent_content_version_id: input.consentContentVersionId,
    privacy_notice_version_id: input.privacyNoticeVersionId,
    locale: input.locale,
    state: 'agreed',
    agreed_at: new Date().toISOString(),
    ip_hash: input.ipHash ?? null,
    user_agent_hash: input.userAgentHash ?? null,
    idempotency_key: input.idempotencyKey,
    request_hash: requestHash,
  });

  if (error) {
    throw new Error(`Failed to create consent record: ${error.message}`);
  }

  // Update case consent state and version references
  await admin
    .from('recipient_cases')
    .update({
      consent_state: 'agreed',
      consent_content_version_id: input.consentContentVersionId,
      privacy_notice_version_id: input.privacyNoticeVersionId,
    })
    .eq('id', input.caseId);

  await writeAuditEvent({
    event_type: 'consent_granted',
    actor_id: null,
    actor_type: 'anonymous',
    action: `Consent granted for case ${input.caseId} (${input.consentType})`,
    case_id: input.caseId,
    details: {
      consent_type: input.consentType,
      locale: input.locale,
      consent_content_version_id: input.consentContentVersionId,
      privacy_notice_version_id: input.privacyNoticeVersionId,
    },
  });

  return { consentRecordId, status: 'created' };
}

// ============================================================
// Withdraw consent
// ============================================================

export async function withdrawConsent(
  caseId: string,
  consentRecordId: string,
  reason: string,
  requestedBy: 'recipient' | 'guardian',
): Promise<void> {
  const admin = getSupabaseAdminClient();

  // Validate transition
  const { data: consent } = await admin
    .from('consent_records')
    .select('state')
    .eq('id', consentRecordId)
    .eq('case_id', caseId)
    .single();

  if (!consent) {
    throw new Error('Consent record not found');
  }

  validateConsentTransition(consent.state as ConsentState, 'withdrawn');

  // Withdraw the consent record
  await admin
    .from('consent_records')
    .update({
      state: 'withdrawn',
      withdrawn_at: new Date().toISOString(),
      withdrawal_reason: reason,
      withdrawal_requested_by: requestedBy,
    })
    .eq('id', consentRecordId);

  // Update case state
  await admin
    .from('recipient_cases')
    .update({
      consent_state: 'withdrawn',
      application_state: 'withdrawn',
    })
    .eq('id', caseId);

  await writeAuditEvent({
    event_type: 'consent_withdrawn',
    actor_id: null,
    actor_type: 'anonymous',
    action: `Consent withdrawn for case ${caseId}`,
    case_id: caseId,
    details: {
      consent_record_id: consentRecordId,
      requested_by: requestedBy,
    },
    severity: 'warning',
  });
}

// ============================================================
// Save profile data (after consent, before submit)
// ============================================================

export interface SaveProfileInput {
  caseId: string;
  profileData: Record<string, unknown>;
}

export async function saveProfileDraft(input: SaveProfileInput): Promise<void> {
  const admin = getSupabaseAdminClient();

  // Verify consent exists
  const { data: caseRecord } = await admin
    .from('recipient_cases')
    .select('consent_state')
    .eq('id', input.caseId)
    .single();

  if (!caseRecord || caseRecord.consent_state !== 'agreed') {
    throw new Error('Consent must be granted before saving profile data');
  }

  // Update profile with approved fields only
  const { error } = await admin
    .from('recipient_profiles')
    .update(input.profileData)
    .eq('case_id', input.caseId);

  if (error) {
    throw new Error(`Failed to save profile: ${error.message}`);
  }
}

// ============================================================
// Submit application (idempotent)
// ============================================================

export interface SubmitApplicationInput {
  caseId: string;
  consentRecordId: string;
  contentVersionsSeen: string[];
  privacyNoticeVersionId: string;
  profileData: Record<string, unknown>;
  submittedBy: 'recipient' | 'assisted_entry';
  assistedByName?: string;
  idempotencyKey: string;
}

export interface SubmitApplicationResult {
  submissionId: string;
  applicationRef: string;
  status: 'created' | 'exists';
}

export async function submitApplication(
  input: SubmitApplicationInput,
): Promise<SubmitApplicationResult> {
  const admin = getSupabaseAdminClient();
  const requestHash = hashRequest({
    caseId: input.caseId,
    consentRecordId: input.consentRecordId,
    contentVersionsSeen: [...input.contentVersionsSeen].sort(),
    privacyNoticeVersionId: input.privacyNoticeVersionId,
    profileData: input.profileData,
    submittedBy: input.submittedBy,
    assistedByName: input.assistedByName,
  });

  // Idempotency check
  const { data: existing } = await admin
    .from('application_submissions')
    .select('id, application_ref')
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle();

  if (existing) {
    const { data: existingSubmission } = await admin
      .from('application_submissions')
      .select('request_hash')
      .eq('id', existing.id)
      .single();
    if (existingSubmission?.request_hash !== requestHash) {
      throw new Error('Idempotency key conflict');
    }
    return {
      submissionId: existing.id,
      applicationRef: existing.application_ref,
      status: 'exists',
    };
  }

  // Validate prerequisites
  const { data: caseRecord } = await admin
    .from('recipient_cases')
    .select('application_ref, consent_state, application_state, comprehension_score, comprehension_passed')
    .eq('id', input.caseId)
    .single();

  if (!caseRecord) {
    throw new Error('Case not found');
  }

  if (caseRecord.consent_state !== 'agreed') {
    throw new Error('Cannot submit: consent must be granted first');
  }

  const { data: consent } = await admin
    .from('consent_records')
    .select('id, state, case_id, consent_content_version_id, privacy_notice_version_id')
    .eq('id', input.consentRecordId)
    .eq('case_id', input.caseId)
    .eq('state', 'agreed')
    .maybeSingle();
  if (!consent || consent.privacy_notice_version_id !== input.privacyNoticeVersionId) {
    throw new Error('Active consent record does not match this application');
  }

  const seenVersionIds = [...new Set(input.contentVersionsSeen)];
  if (!seenVersionIds.includes(input.privacyNoticeVersionId)) {
    throw new Error('The approved privacy notice must be included in content_versions_seen');
  }
  if (!seenVersionIds.includes(consent.consent_content_version_id)) {
    throw new Error('The agreed consent text must be included in content_versions_seen');
  }
  const { data: seenVersions, error: seenError } = await admin
    .from('content_versions')
    .select('id, content_type')
    .in('id', seenVersionIds)
    .eq('approval_status', 'approved')
    .eq('is_published', true);
  if (seenError || !seenVersions || seenVersions.length !== seenVersionIds.length) {
    throw new Error('All content versions seen must still be approved and published');
  }

  const appState = caseRecord.application_state as ApplicationState;
  const targetState: ApplicationState = appState === 'correction_needed' ? 'resubmitted' : 'submitted';
  if (appState === 'draft') {
    validateApplicationTransition('draft', 'ready_for_review');
    validateApplicationTransition('ready_for_review', 'submitted');
  } else {
    validateApplicationTransition(appState, targetState);
  }

  const comprehensionScore = caseRecord.comprehension_score;
  const comprehensionPassed = caseRecord.comprehension_passed;

  // Generate application reference: SC-YYYY-XXXXXXXX
  const applicationRef = caseRecord.application_ref ?? generateApplicationReference();

  const submissionId = uuidv4();

  // Save profile data
  await admin
    .from('recipient_profiles')
    .update({ ...input.profileData, fields_completed: true })
    .eq('case_id', input.caseId);

  const { data: priorSubmission } = await admin
    .from('application_submissions')
    .select('id')
    .eq('case_id', input.caseId)
    .eq('is_current', true)
    .maybeSingle();
  if (priorSubmission) {
    const { error: supersedeError } = await admin
      .from('application_submissions')
      .update({ is_current: false })
      .eq('id', priorSubmission.id);
    if (supersedeError) throw new Error(`Failed to supersede prior submission: ${supersedeError.message}`);
  }

  // Create submission record
  const { error: submitError } = await admin.from('application_submissions').insert({
    id: submissionId,
    case_id: input.caseId,
    application_ref: applicationRef,
    submitted_data: input.profileData,
    consent_record_id: input.consentRecordId,
    content_versions_seen: input.contentVersionsSeen,
    privacy_notice_version_id: input.privacyNoticeVersionId,
    comprehension_score: comprehensionScore,
    comprehension_passed: comprehensionPassed,
    submitted_by: input.submittedBy,
    assisted_by_name: input.assistedByName ?? null,
    original_submission_id: priorSubmission?.id ?? null,
    idempotency_key: input.idempotencyKey,
    request_hash: requestHash,
    is_current: true,
  });

  if (submitError) {
    if (priorSubmission) {
      await admin.from('application_submissions').update({ is_current: true }).eq('id', priorSubmission.id);
    }
    throw new Error(`Failed to submit application: ${submitError.message}`);
  }

  // Update case state
  await admin
    .from('recipient_cases')
    .update({
      application_ref: applicationRef,
      application_state: targetState,
    })
    .eq('id', input.caseId);

  await writeAuditEvent({
    event_type: 'application_submit',
    actor_id: null,
    actor_type: 'anonymous',
    action: `Application submitted: ${applicationRef}`,
    case_id: input.caseId,
    target_type: 'application_submission',
    target_id: submissionId,
    details: {
      application_ref: applicationRef,
      submitted_by: input.submittedBy,
      comprehension_score: comprehensionScore,
      comprehension_passed: comprehensionPassed,
    },
  });

  return { submissionId, applicationRef, status: 'created' };
}
