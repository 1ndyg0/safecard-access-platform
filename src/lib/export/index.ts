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
import { hashSensitiveIdentifier } from '@/lib/audit';
import { requireRole, requireMfa, logPermissionDenial } from '@/lib/auth/permissions';
import { createHash, randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

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
      application_review_state,
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
    .eq('application_review_state', 'approved')
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

  const submissionIds = cases.map((c: Record<string, unknown>) => {
    const submission = Array.isArray(c.application_submissions)
      ? c.application_submissions[0]
      : c.application_submissions as Record<string, unknown> | undefined;
    return submission?.id as string;
  });
  if (submissionIds.some((id) => !id)) throw new Error('Export submission version is missing');

  const batchId = uuidv4();
  const { error: batchError } = await admin.rpc('create_prc_export_batch_atomic', {
    p_batch_id: batchId,
    p_campaign_id: input.campaignId,
    p_batch_ref: batchRef,
    p_created_by: input.userId,
    p_creation_reason: input.creationReason,
    p_reauth_method: input.reauthMethod,
    p_column_order: columnOrder,
    p_checksum: checksum,
    p_format: input.format,
    p_case_ids: requestedCaseIds,
    p_submission_ids: submissionIds,
    p_original_values: exportRows,
    p_actor_ip_hash: input.userIp ? hashSensitiveIdentifier(input.userIp) : null,
  });
  if (batchError) throw new Error(`Failed to create export batch: ${batchError.message}`);

  return {
    batchId,
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
  const { data: item, error: itemError } = await admin
    .from('prc_export_items')
    .select('id,prc_export_batches!inner(campaign_id)')
    .eq('id', input.exportItemId)
    .maybeSingle();
  if (itemError || !item) throw new Error('Export item not found');
  const batch = Array.isArray(item.prc_export_batches)
    ? item.prc_export_batches[0]
    : item.prc_export_batches;
  const access = await requireRole(input.actorId, 'prc_liaison', batch.campaign_id);
  if (!access.allowed) throw new Error('Permission denied: campaign PRC liaison role required');

  const { error } = await admin.rpc('acknowledge_prc_export_item_atomic', {
    p_export_item_id: input.exportItemId,
    p_prc_status: input.prcStatus,
    p_prc_notes: input.prcNotes ?? null,
    p_correction_reason: input.correctionReason ?? null,
    p_correction_fields: input.correctionFields ?? null,
    p_prc_membership_id: input.prcMembershipId ?? null,
    p_prc_effective_date: input.prcEffectiveDate ?? null,
    p_prc_expiry_date: input.prcExpiryDate ?? null,
    p_actor_id: input.actorId,
  });
  if (error) throw new Error(`PRC response could not be recorded: ${error.message}`);
}
