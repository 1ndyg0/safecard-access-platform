/**
 * PRC export and handoff service
 *
 * Journey phase 6: PRC Handoff and Reconciliation
 *
 * Key rules:
 * - Exports require staff permission, reauthentication, and reason logging
 * - Each batch has a stable revision, timestamp, creator, checksum
 * - CSV must be protected against spreadsheet formula injection
 * - PRC acknowledgment is tracked per record
 * - Corrections preserve original values
 * - PRC confirmation is the ONLY source of membership activation
 */

import { getSupabaseAdminClient } from '@/lib/db/client';
import { writeAuditEvent } from '@/lib/audit';
import { requireRole, requireMfa, logPermissionDenial } from '@/lib/auth/permissions';
import {
  validatePrcHandoffTransition,
  validateMembershipTransition,
} from '@/lib/state-machines';
import type { PrcHandoffState } from '@/types/database';
import type { MembershipState } from '@/types/database';
import { createHash, randomBytes } from 'node:crypto';

// ============================================================
// CSV injection protection
// ============================================================

/**
 * Sanitize a cell value to prevent spreadsheet formula injection.
 * Cells starting with =, +, -, @, tab, or carriage return are dangerous.
 */
function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`; // Prefix with single quote to prevent formula execution
  }
  // Escape double quotes and wrap in quotes if contains comma/newline
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate a CSV string from rows with injection protection.
 */
function generateSafeCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.map(sanitizeCsvCell).join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => sanitizeCsvCell(row[h])).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

// ============================================================
// Create export batch
// ============================================================

export interface CreateExportBatchInput {
  campaignId: string;
  creationReason: string;
  caseIds: string[];
  reauthMethod: 'password' | 'mfa' | 'session_refresh';
  format: 'csv' | 'json';
  userId: string;
  userIp?: string;
}

export interface ExportBatchResult {
  batchId: string;
  batchRef: string;
  recordCount: number;
  checksum: string;
  csvContent?: string;
  jsonContent?: Record<string, unknown>[];
}

export async function createExportBatch(
  input: CreateExportBatchInput,
): Promise<ExportBatchResult> {
  const admin = getSupabaseAdminClient();

  // Permission checks
  const roleCheck = await requireRole(input.userId, 'finance_export', input.campaignId);
  if (!roleCheck.allowed) {
    // Also check school_admin
    const adminCheck = await requireRole(input.userId, 'school_admin', input.campaignId);
    if (!adminCheck.allowed) {
      await logPermissionDenial(input.userId, 'create_export_batch', 'Insufficient role', input.userIp);
      throw new Error('Permission denied: export requires finance_export or school_admin role');
    }
  }

  // MFA check for exports
  const mfaCheck = await requireMfa();
  if (!mfaCheck.allowed) {
    await logPermissionDenial(input.userId, 'create_export_batch', mfaCheck.reason!, input.userIp);
    throw new Error(mfaCheck.reason);
  }

  const batchRef = `EXP-${new Date().getUTCFullYear()}-${randomBytes(5).toString('hex').toUpperCase()}`;
  const requestedCaseIds = [...new Set(input.caseIds)].sort();

  // Fetch the records to export
  const { data: cases } = await admin
    .from('recipient_cases')
    .select(`
      id,
      application_ref,
      consent_state,
      application_state,
      payment_state,
      recipient_profiles!inner (
        first_name,
        middle_name,
        last_name,
        date_of_birth,
        sex,
        civil_status,
        address_line1,
        address_line2,
        city,
        province,
        zip_code,
        mobile_number,
        email
      ),
      application_submissions!inner (
        id,
        submitted_at,
        comprehension_passed
      ),
      payment_intents!inner (
        state,
        payment_reference,
        expected_amount,
        verified_at
      )
    `)
    .in('id', requestedCaseIds)
    .eq('campaign_id', input.campaignId)
    .eq('consent_state', 'agreed')
    .in('application_state', ['submitted', 'resubmitted'])
    .eq('payment_state', 'verified_by_official_source')
    .eq('payment_intents.state', 'verified_by_official_source')
    .eq('prc_handoff_state', 'ready_for_export')
    .eq('application_submissions.is_current', true)
    .order('id', { ascending: true });

  if (!cases || cases.length !== requestedCaseIds.length) {
    throw new Error('One or more records are missing, cross-campaign, or not eligible for export');
  }

  // PRC-approved column order
  const columnOrder = [
    'application_ref',
    'first_name',
    'middle_name',
    'last_name',
    'date_of_birth',
    'sex',
    'civil_status',
    'address_line1',
    'address_line2',
    'city',
    'province',
    'zip_code',
    'mobile_number',
    'email',
    'payment_status',
    'payment_reference',
    'payment_amount',
    'submitted_at',
    'comprehension_passed',
  ];

  // Flatten records for export
  const exportRows = cases.map((c: Record<string, unknown>) => {
    const profile = Array.isArray(c.recipient_profiles)
      ? c.recipient_profiles[0]
      : c.recipient_profiles as Record<string, unknown> | undefined;
    const submission = Array.isArray(c.application_submissions)
      ? c.application_submissions[0]
      : c.application_submissions as Record<string, unknown> | undefined;
    const payment = Array.isArray(c.payment_intents)
      ? c.payment_intents[0]
      : c.payment_intents as Record<string, unknown> | undefined;

    return {
      application_ref: c.application_ref,
      first_name: profile?.first_name,
      middle_name: profile?.middle_name,
      last_name: profile?.last_name,
      date_of_birth: profile?.date_of_birth,
      sex: profile?.sex,
      civil_status: profile?.civil_status,
      address_line1: profile?.address_line1,
      address_line2: profile?.address_line2,
      city: profile?.city,
      province: profile?.province,
      zip_code: profile?.zip_code,
      mobile_number: profile?.mobile_number,
      email: profile?.email,
      payment_status: payment?.state ?? 'not_started',
      payment_reference: payment?.payment_reference ?? '',
      payment_amount: payment?.expected_amount ?? '',
      submitted_at: submission?.submitted_at,
      comprehension_passed: submission?.comprehension_passed,
    };
  });

  // Generate content and checksum
  let csvContent: string | undefined;
  let jsonContent: Record<string, unknown>[] | undefined;

  if (input.format === 'csv') {
    csvContent = generateSafeCsv(columnOrder, exportRows);
  } else {
    jsonContent = exportRows;
  }

  const contentToHash = input.format === 'csv' ? csvContent! : JSON.stringify(jsonContent);
  const checksum = createHash('sha256').update(contentToHash).digest('hex');

  // Create the immutable batch record
  const { data: batch, error: batchError } = await admin
    .from('prc_export_batches')
    .insert({
      campaign_id: input.campaignId,
      batch_ref: batchRef,
      created_by: input.userId,
      creation_reason: input.creationReason,
      reauth_method: input.reauthMethod,
      reauth_at: new Date().toISOString(),
      record_count: cases.length,
      column_order: columnOrder,
      checksum,
      format: input.format,
    })
    .select('id')
    .single();

  if (batchError || !batch) {
    throw new Error(`Failed to create export batch: ${batchError?.message}`);
  }

  // Create export items (one per case)
  const exportItems = cases.map((c: Record<string, unknown>, index) => {
    const submission = Array.isArray(c.application_submissions)
      ? c.application_submissions[0]
      : c.application_submissions as Record<string, unknown> | undefined;
    return {
      batch_id: batch.id,
      case_id: c.id,
      submission_id: submission?.id,
      export_order: index,
      prc_status: 'pending',
      original_values: exportRows[index],
    };
  });

  const { error: itemError } = await admin.from('prc_export_items').insert(exportItems);
  if (itemError) throw new Error(`Failed to create export items: ${itemError.message}`);

  // Update case handoff states
  const { error: caseUpdateError } = await admin
    .from('recipient_cases')
    .update({
      prc_handoff_state: 'exported',
      membership_state: 'pending_prc_confirmation',
    })
    .in('id', requestedCaseIds);
  if (caseUpdateError) throw new Error(`Failed to advance exported cases: ${caseUpdateError.message}`);

  // Audit
  await writeAuditEvent({
    event_type: 'export_created',
    actor_id: input.userId,
    actor_type: 'user',
    action: `Export batch ${batchRef} created with ${cases.length} records`,
    campaign_id: input.campaignId,
    target_type: 'prc_export_batch',
    target_id: batch.id,
    details: {
      batch_ref: batchRef,
      record_count: cases.length,
      format: input.format,
      checksum,
      reauth_method: input.reauthMethod,
      case_ids: requestedCaseIds,
    },
    actor_ip: input.userIp,
  });

  return {
    batchId: batch.id,
    batchRef,
    recordCount: cases.length,
    checksum,
    csvContent,
    jsonContent,
  };
}

// ============================================================
// Acknowledge PRC export item
// ============================================================

export interface AcknowledgePrcItemInput {
  exportItemId: string;
  prcStatus: 'acknowledged' | 'correction_requested' | 'accepted' | 'rejected';
  prcNotes?: string;
  correctionReason?: string;
  correctionFields?: Record<string, unknown>;
  prcMembershipId?: string;
  prcEffectiveDate?: string;
  prcExpiryDate?: string;
  actorId: string;
}

export async function acknowledgePrcItem(
  input: AcknowledgePrcItemInput,
): Promise<void> {
  const admin = getSupabaseAdminClient();

  // Get current item and case
  const { data: item } = await admin
    .from('prc_export_items')
    .select('id, case_id, prc_status, submission_id')
    .eq('id', input.exportItemId)
    .single();

  if (!item) {
    throw new Error('Export item not found');
  }

  validatePrcHandoffTransition(item.prc_status === 'pending' ? 'exported' : item.prc_status as PrcHandoffState, input.prcStatus);

  // Update the export item
  await admin
    .from('prc_export_items')
    .update({
      prc_status: input.prcStatus,
      prc_responded_at: new Date().toISOString(),
      prc_response_by: input.actorId,
      prc_notes: input.prcNotes ?? null,
      correction_reason: input.correctionReason ?? null,
      correction_fields: input.correctionFields ?? null,
      prc_membership_id: input.prcMembershipId ?? null,
      prc_effective_date: input.prcEffectiveDate ?? null,
      prc_expiry_date: input.prcExpiryDate ?? null,
      prc_source_timestamp: new Date().toISOString(),
    })
    .eq('id', input.exportItemId);

  // Update case handoff state
  let newHandoffState: PrcHandoffState;
  switch (input.prcStatus) {
    case 'acknowledged':
      newHandoffState = 'acknowledged';
      break;
    case 'correction_requested':
      newHandoffState = 'correction_requested';
      // Also update application state
      await admin
        .from('recipient_cases')
        .update({ application_state: 'correction_needed' })
        .eq('id', item.case_id);
      break;
    case 'accepted':
      newHandoffState = 'accepted';
      break;
    case 'rejected':
      newHandoffState = 'rejected';
      break;
    default:
      newHandoffState = 'acknowledged';
  }

  await admin
    .from('recipient_cases')
    .update({ prc_handoff_state: newHandoffState })
    .eq('id', item.case_id);

  // If PRC accepted and provided membership ID, activate membership
  if (input.prcStatus === 'accepted' && input.prcMembershipId && input.prcEffectiveDate) {
    await activateMembership(
      item.case_id,
      input.exportItemId,
      input.prcMembershipId,
      input.prcEffectiveDate,
      input.prcExpiryDate,
      input.actorId,
    );
  }

  // If PRC rejected, update membership state
  if (input.prcStatus === 'rejected') {
    await admin
      .from('recipient_cases')
      .update({ membership_state: 'declined' })
      .eq('id', item.case_id);

    await admin.from('membership_status_events').insert({
      case_id: item.case_id,
      previous_state: 'pending_prc_confirmation',
      new_state: 'declined',
      changed_by: input.actorId,
      change_source: 'prc_rejection',
      prc_export_item_id: input.exportItemId,
      reason: input.prcNotes ?? 'Rejected by PRC',
    });
  }

  await writeAuditEvent({
    event_type: 'prc_acknowledgment',
    actor_id: input.actorId,
    actor_type: 'user',
    action: `PRC ${input.prcStatus} for export item ${input.exportItemId}`,
    case_id: item.case_id,
    target_type: 'prc_export_item',
    target_id: input.exportItemId,
    details: {
      prc_status: input.prcStatus,
      prc_membership_id: input.prcMembershipId,
      correction_reason: input.correctionReason,
    },
  });
}

// ============================================================
// Activate membership (PRC confirmation ONLY)
// ============================================================

async function activateMembership(
  caseId: string,
  exportItemId: string,
  prcMembershipId: string,
  effectiveDate: string,
  expiryDate: string | undefined,
  actorId: string,
): Promise<void> {
  const admin = getSupabaseAdminClient();

  // Get current membership state
  const { data: caseRecord } = await admin
    .from('recipient_cases')
    .select('membership_state')
    .eq('id', caseId)
    .single();

  if (!caseRecord) return;

  validateMembershipTransition(
    caseRecord.membership_state as MembershipState,
    'active_confirmed',
  );

  // Update case
  await admin
    .from('recipient_cases')
    .update({ membership_state: 'active_confirmed' })
    .eq('id', caseId);

  // Create immutable membership event
  await admin.from('membership_status_events').insert({
    case_id: caseId,
    previous_state: caseRecord.membership_state,
    new_state: 'active_confirmed',
    changed_by: actorId,
    change_source: 'prc_confirmation',
    prc_export_item_id: exportItemId,
    prc_membership_id: prcMembershipId,
    prc_effective_date: effectiveDate,
    prc_expiry_date: expiryDate ?? null,
    reason: 'Membership confirmed by PRC',
    evidence: { prc_membership_id: prcMembershipId },
  });

  await writeAuditEvent({
    event_type: 'membership_status_change',
    actor_id: actorId,
    actor_type: 'user',
    action: `Membership activated for case ${caseId}: ${prcMembershipId}`,
    case_id: caseId,
    details: {
      prc_membership_id: prcMembershipId,
      effective_date: effectiveDate,
      expiry_date: expiryDate,
    },
  });
}
