/**
 * Support and privacy request service
 *
 * 8 categories from the spec:
 * 1. General question
 * 2. Trouble applying
 * 3. Payment handoff issue
 * 4. Correction request
 * 5. Consent withdrawal
 * 6. Privacy request
 * 7. Emergency/claims education (points to PRC, does NOT adjudicate)
 * 8. PRC handoff issue
 *
 * Privacy operations:
 * - Consent withdrawal
 * - Data correction request
 * - Access request
 * - Deletion/retention request
 * - Incident logging
 */

import { getSupabaseAdminClient } from '@/lib/db/client';
import { writeAuditEvent } from '@/lib/audit';
import { validateSupportTransition } from '@/lib/state-machines';
import type { SupportState, SupportCategory } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Create support case
// ============================================================

export interface CreateSupportCaseInput {
  caseId?: string;
  campaignId?: string;
  category: SupportCategory;
  subject: string;
  description: string;
  submittedByType: 'recipient' | 'sponsor' | 'guardian' | 'staff' | 'system';
  submittedByUserId?: string;
  contactMethod?: string;
  isPrivacyRequest?: boolean;
  privacyRequestType?: string;
  idempotencyKey?: string;
}

export async function createSupportCase(
  input: CreateSupportCaseInput,
): Promise<{ supportCaseId: string; status: 'created' | 'exists' }> {
  const admin = getSupabaseAdminClient();

  // Idempotency check
  if (input.idempotencyKey) {
    const { data: existing } = await admin
      .from('support_cases')
      .select('id')
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle();

    if (existing) {
      return { supportCaseId: existing.id, status: 'exists' };
    }
  }

  const supportCaseId = uuidv4();

  // Auto-set priority based on category
  let priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';
  if (input.category === 'consent_withdrawal' || input.category === 'privacy_request') {
    priority = 'high';
  }
  if (input.category === 'emergency_claims_education') {
    priority = 'urgent'; // Route to PRC contacts immediately
  }

  const { error } = await admin.from('support_cases').insert({
    id: supportCaseId,
    case_id: input.caseId ?? null,
    campaign_id: input.campaignId ?? null,
    category: input.category,
    state: 'open',
    subject: input.subject,
    description: input.description,
    submitted_by_type: input.submittedByType,
    submitted_by_user_id: input.submittedByUserId ?? null,
    contact_method: input.contactMethod ?? null,
    priority,
    is_privacy_request: input.isPrivacyRequest ?? false,
    privacy_request_type: input.privacyRequestType ?? null,
    idempotency_key: input.idempotencyKey ?? null,
  });

  if (error) {
    throw new Error(`Failed to create support case: ${error.message}`);
  }

  await writeAuditEvent({
    event_type: 'support_case_change',
    actor_id: input.submittedByUserId ?? null,
    actor_type: input.submittedByUserId ? 'user' : 'anonymous',
    action: `Support case created: ${input.category}`,
    case_id: input.caseId,
    campaign_id: input.campaignId,
    target_type: 'support_case',
    target_id: supportCaseId,
    details: {
      category: input.category,
      priority,
      is_privacy_request: input.isPrivacyRequest,
    },
  });

  return { supportCaseId, status: 'created' };
}

// ============================================================
// Update support case state
// ============================================================

export async function updateSupportCaseState(
  supportCaseId: string,
  newState: SupportState,
  actorId: string,
  resolutionSummary?: string,
): Promise<void> {
  const admin = getSupabaseAdminClient();

  const { data: current } = await admin
    .from('support_cases')
    .select('state')
    .eq('id', supportCaseId)
    .single();

  if (!current) {
    throw new Error('Support case not found');
  }

  validateSupportTransition(current.state as SupportState, newState);

  const updates: Record<string, unknown> = { state: newState };

  if (newState === 'resolved' || newState === 'closed_no_response') {
    updates.resolved_at = new Date().toISOString();
    updates.resolved_by = actorId;
    updates.resolution_summary = resolutionSummary ?? null;
  }

  await admin
    .from('support_cases')
    .update(updates)
    .eq('id', supportCaseId);

  await writeAuditEvent({
    event_type: 'support_case_change',
    actor_id: actorId,
    actor_type: 'user',
    action: `Support case ${supportCaseId} state changed to ${newState}`,
    target_type: 'support_case',
    target_id: supportCaseId,
    details: { previous_state: current.state, new_state: newState },
  });
}

// ============================================================
// Process consent withdrawal (stops reminders and processing)
// ============================================================

export async function processConsentWithdrawalRequest(
  supportCaseId: string,
  actorId: string,
): Promise<void> {
  const admin = getSupabaseAdminClient();

  const { data: supportCase } = await admin
    .from('support_cases')
    .select('case_id, category, state')
    .eq('id', supportCaseId)
    .single();
  if (!supportCase?.case_id || supportCase.category !== 'consent_withdrawal') {
    throw new Error('Support case is not a valid consent withdrawal request');
  }
  const caseId = supportCase.case_id;

  // Find active consent records for this case
  const { data: consents } = await admin
    .from('consent_records')
    .select('id')
    .eq('case_id', caseId)
    .eq('state', 'agreed');

  if (consents && consents.length > 0) {
    // Mark all active consents as withdrawn
    await admin
      .from('consent_records')
      .update({
        state: 'withdrawn',
        withdrawn_at: new Date().toISOString(),
        withdrawal_reason: `Via support case ${supportCaseId}`,
        withdrawal_requested_by: 'recipient',
      })
      .eq('case_id', caseId)
      .eq('state', 'agreed');
  }

  // Update case states
  await admin
    .from('recipient_cases')
    .update({
      consent_state: 'withdrawn',
      application_state: 'withdrawn',
    })
    .eq('id', caseId);

  // Cancel pending notifications for this case
  await admin
    .from('notification_events')
    .update({ status: 'opted_out', opted_out_at: new Date().toISOString() })
    .eq('case_id', caseId)
      .eq('status', 'pending');

  await admin
    .from('support_cases')
    .update({
      state: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: actorId,
      resolution_summary: 'Consent withdrawal processed',
    })
    .eq('id', supportCaseId);

  await writeAuditEvent({
    event_type: 'consent_withdrawn',
    actor_id: actorId,
    actor_type: 'user',
    action: `Consent withdrawn for case ${caseId} via support request`,
    case_id: caseId,
    details: { support_case_id: supportCaseId },
    severity: 'warning',
  });
}
