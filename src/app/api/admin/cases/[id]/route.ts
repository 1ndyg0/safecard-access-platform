/**
 * GET /api/admin/cases/[id]
 *
 * One case, projected to what the caller's role may see.
 *
 * The profile query selects an explicit column list derived from the
 * caller's roles. A finance reviewer's response body contains no
 * address and no date of birth because those columns were never
 * selected, not because the browser hides them.
 *
 * Opening a case is recorded in the audit trail with the field names
 * disclosed — never their values.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { badRequest, forbidden, notFound } from '@/lib/api/response';
import {
  assertCampaignAccess,
  logCaseAccess,
  rolesForCampaign,
  resolveStaffScope,
} from '@/lib/admin/access';
import { handleAdminError, PRIVATE_NO_STORE } from '@/lib/admin/respond';
import { profileSelectClause, resolveCaseAccessPolicy } from '@/lib/admin/field-policy';

export const dynamic = 'force-dynamic';

/**
 * Explicit column list. Written as a literal rather than joined at
 * runtime so the client keeps its row typing — and so a reader can see
 * exactly which columns leave the database.
 */
const CASE_COLUMNS =
  'id,campaign_id,application_ref,consent_state,application_state,application_review_state,payment_state,prc_handoff_state,membership_state,created_at,updated_at';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const scope = await resolveStaffScope();
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return badRequest('Case id must be a UUID.');

    const admin = getSupabaseAdminClient();
    const { data: caseRecord, error: caseError } = await admin
      .from('recipient_cases')
      .select(CASE_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (caseError) throw new Error(`Failed to load case: ${caseError.message}`);
    if (!caseRecord) return notFound('Case not found.');

    // Cross-campaign access is a 403, not an empty body.
    assertCampaignAccess(scope, caseRecord.campaign_id as string);
    const policy = resolveCaseAccessPolicy(
      rolesForCampaign(scope, caseRecord.campaign_id as string),
    );
    if (!policy) return forbidden('Your role cannot open individual cases.');

    const profileColumns = profileSelectClause(policy);
    let profile: Record<string, unknown> | null = null;
    if (profileColumns) {
      const { data, error } = await admin
        .from('recipient_profiles')
        .select(profileColumns)
        .eq('case_id', id)
        .maybeSingle();
      if (error) throw new Error(`Failed to load profile: ${error.message}`);
      profile = (data as Record<string, unknown> | null) ?? null;
    }

    // The current submission drives the review panel and the wait clock.
    const { data: submission, error: submissionError } = await admin
      .from('application_submissions')
      .select('id,application_ref,submitted_at,submitted_by,correction_reason,original_submission_id,is_current')
      .eq('case_id', id)
      .eq('is_current', true)
      .maybeSingle();
    if (submissionError) {
      throw new Error(`Failed to load submission: ${submissionError.message}`);
    }

    let payments: Array<Record<string, unknown>> = [];
    if (policy.canViewPayments) {
      const { data, error } = await admin
        .from('payment_intents')
        .select(
          'id,expected_amount,currency,payment_route,state,payment_reference,created_at,updated_at',
        )
        .eq('case_id', id)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Failed to load payments: ${error.message}`);
      payments = (data ?? []) as Array<Record<string, unknown>>;

      // Evidence is versioned by insertion: every submission is a new
      // row and older rows are kept, so the reviewer sees what was
      // replaced rather than only what is current.
      const intentIds = payments.map((payment) => payment.id as string);
      if (intentIds.length > 0) {
        const { data: evidence, error: evidenceError } = await admin
          .from('payment_evidence_versions')
          .select(
            'id,payment_evidence_id,payment_intent_id,version_number,content_type,file_size_bytes,sha256,state,uploaded_at,reviewed_at,payment_evidence!inner(evidence_type,reference_number,amount_confirmed,currency,source,is_verified,confirmed_at,created_at)',
          )
          .in('payment_intent_id', intentIds)
          .order('uploaded_at', { ascending: false });
        if (evidenceError) {
          throw new Error(`Failed to load payment evidence: ${evidenceError.message}`);
        }
        const byIntent = new Map<string, Array<Record<string, unknown>>>();
        (evidence ?? []).forEach((row) => {
          const key = row.payment_intent_id as string;
          if (!byIntent.has(key)) byIntent.set(key, []);
          const parent = Array.isArray(row.payment_evidence)
            ? row.payment_evidence[0]
            : row.payment_evidence;
          byIntent.get(key)?.push({
            id: row.id,
            version_number: row.version_number,
            content_type: row.content_type,
            file_size_bytes: row.file_size_bytes,
            sha256: row.sha256,
            state: row.state,
            uploaded_at: row.uploaded_at,
            reviewed_at: row.reviewed_at,
            evidence_type: parent?.evidence_type,
            reference_number: parent?.reference_number,
            amount_confirmed: parent?.amount_confirmed,
            currency: parent?.currency,
            source: parent?.source,
            is_verified: parent?.is_verified,
            confirmed_at: parent?.confirmed_at,
            created_at: parent?.created_at,
          });
        });
        payments = payments.map((payment, index) => ({
          ...payment,
          payment_state: payment.state,
          evidence: byIntent.get(payment.id as string) ?? [],
          // The newest row is current; anything after it was superseded.
          isLatestIntent: index === 0,
        }));
      }
    }

    await logCaseAccess({
      scope,
      caseId: id,
      campaignId: caseRecord.campaign_id as string,
      fieldsDisclosed: policy.profileFields as unknown as string[],
    });

    return NextResponse.json(
      {
        case: caseRecord,
        profile,
        submission: submission ?? null,
        payments,
        capabilities: {
          canViewPayments: policy.canViewPayments,
          canActOnPayments: policy.canActOnPayments,
          canViewAudit: policy.canViewAudit,
          canReviewApplication: policy.canReviewApplication,
          profileFields: policy.profileFields,
        },
      },
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error) {
    return handleAdminError(error, 'Admin case detail');
  }
}
