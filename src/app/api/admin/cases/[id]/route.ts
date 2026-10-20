/**
 * GET /api/admin/cases/[id]
 *
 * One complete application, for the review slide-over: who applied, what they
 * submitted, and the proof of payment.
 *
 * The profile query selects an explicit column list derived from the
 * caller's roles. A field the role may not read is never selected, so it
 * cannot appear in the response body.
 *
 * Opening an application is recorded in the audit trail with the field names
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const scope = await resolveStaffScope();
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return badRequest('Application id must be a UUID.');

    const admin = getSupabaseAdminClient();

    // The view is the only place "complete application" is defined.
    const { data: application, error: applicationError } = await admin
      .from('admin_applications_view')
      .select('id,campaign_id,application_ref,status,received_at,rejection_reason,reviewed_at')
      .eq('id', id)
      .maybeSingle();
    if (applicationError) throw new Error(`Failed to load application: ${applicationError.message}`);
    if (!application) return notFound('Application not found.');

    const campaignId = application.campaign_id as string;
    // Cross-campaign access is a 403, not an empty body.
    assertCampaignAccess(scope, campaignId);
    const policy = resolveCaseAccessPolicy(rolesForCampaign(scope, campaignId));
    if (!policy) return forbidden('Your role cannot open applications.');

    const { data: caseRecord, error: caseError } = await admin
      .from('recipient_cases')
      .select('application_review_state')
      .eq('id', id)
      .maybeSingle();
    if (caseError) throw new Error(`Failed to load application: ${caseError.message}`);

    const profileColumns = profileSelectClause(policy);
    let applicant: Record<string, unknown> | null = null;
    if (profileColumns) {
      const { data, error } = await admin
        .from('recipient_profiles')
        .select(profileColumns)
        .eq('case_id', id)
        .maybeSingle();
      if (error) throw new Error(`Failed to load applicant: ${error.message}`);
      applicant = (data as Record<string, unknown> | null) ?? null;
    }

    let payment: Record<string, unknown> | null = null;
    if (policy.canViewPayments) {
      const { data: intent, error: intentError } = await admin
        .from('payment_intents')
        .select(
          'id,state,expected_amount,currency,payment_route,payment_reference,payer_reported_paid_on,payer_reported_amount',
        )
        .eq('case_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (intentError) throw new Error(`Failed to load payment: ${intentError.message}`);

      if (intent) {
        const { data: version, error: versionError } = await admin
          .from('payment_evidence_versions')
          .select(
            'id,content_type,uploaded_at,state,payment_evidence!inner(reference_number,amount_confirmed,currency,is_verified)',
          )
          .eq('payment_intent_id', intent.id)
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (versionError) throw new Error(`Failed to load payment proof: ${versionError.message}`);
        const parent = version
          ? Array.isArray(version.payment_evidence)
            ? version.payment_evidence[0]
            : version.payment_evidence
          : null;

        payment = {
          intent_id: intent.id,
          state: intent.state,
          route: intent.payment_route,
          reference: intent.payment_reference ?? parent?.reference_number ?? null,
          amount: parent?.amount_confirmed ?? intent.payer_reported_amount ?? intent.expected_amount,
          currency: parent?.currency ?? intent.currency,
          paid_on: intent.payer_reported_paid_on,
          proof: version
            ? {
                evidence_id: version.id,
                content_type: version.content_type,
                uploaded_at: version.uploaded_at,
                verified: Boolean(parent?.is_verified),
              }
            : null,
        };
      }
    }

    await logCaseAccess({
      scope,
      caseId: id,
      campaignId,
      fieldsDisclosed: policy.profileFields as unknown as string[],
    });

    return NextResponse.json(
      {
        application: {
          id: application.id,
          application_ref: application.application_ref,
          status: application.status,
          review_state: caseRecord?.application_review_state ?? 'pending',
          received_at: application.received_at,
          rejection_reason: application.rejection_reason,
          reviewed_at: application.reviewed_at,
        },
        applicant,
        payment,
        capabilities: {
          canDecide: policy.canReviewApplication,
          canApprove: policy.canReviewApplication && policy.canActOnPayments,
          profileFields: policy.profileFields,
        },
      },
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error) {
    return handleAdminError(error, 'Admin application detail');
  }
}
