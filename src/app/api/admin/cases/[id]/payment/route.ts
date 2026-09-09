/**
 * POST /api/admin/cases/[id]/payment
 *
 * Finance actions on one payment intent: verify the payment, or request
 * replacement evidence.
 *
 * Three properties this route holds deliberately:
 *
 *   1. It acts on exactly one payment intent, named in the body and
 *      re-read from the database inside the request. There is no bulk
 *      form of this action.
 *   2. It requires an explicit confirmation flag. A verification that
 *      can be triggered by a stray click is not a verification.
 *   3. Verifying a payment moves payment_state only. It does not touch
 *      application_state, prc_handoff_state or membership_state. Money
 *      arriving is not an application decision and is not membership.
 *      Only a PRC confirmation may produce active_confirmed, and that
 *      path does not pass through this file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { badRequest, conflict, forbidden, notFound } from '@/lib/api/response';
import { assertCampaignAccess, resolveStaffScope } from '@/lib/admin/access';
import { handleAdminError, PRIVATE_NO_STORE } from '@/lib/admin/respond';
import { resolveCaseAccessPolicy } from '@/lib/admin/field-policy';
import { validatePaymentTransition } from '@/lib/state-machines';
import { writeAuditEvent } from '@/lib/audit';
import type { PaymentState } from '@/types/database';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('verify_payment'),
    payment_intent_id: z.string().uuid(),
    /** Must be true. Present so the decision cannot be made by accident. */
    confirm: z.literal(true),
    /** The evidence row the reviewer actually looked at. */
    evidence_id: z.string().uuid(),
    /** Guards against acting on a stale screen. */
    expected_payment_state: z.string().min(1),
  }),
  z.object({
    action: z.literal('request_reupload'),
    payment_intent_id: z.string().uuid(),
    confirm: z.literal(true),
    /** Shown to the applicant, so it must be safe to read. */
    reason: z.string().trim().min(10).max(500),
    expected_payment_state: z.string().min(1),
  }),
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const scope = await resolveStaffScope();
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return badRequest('Case id must be a UUID.');

    const policy = resolveCaseAccessPolicy(scope.roles);
    if (!policy?.canActOnPayments) {
      return forbidden('Your role cannot act on payment evidence.');
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return badRequest(
        'A payment action requires the intent id, an explicit confirmation and the state you saw.',
      );
    }
    const body = parsed.data;

    const admin = getSupabaseAdminClient();

    const { data: caseRecord, error: caseError } = await admin
      .from('recipient_cases')
      .select('id,campaign_id,payment_state,membership_state')
      .eq('id', id)
      .maybeSingle();
    if (caseError) throw new Error(`Failed to load case: ${caseError.message}`);
    if (!caseRecord) return notFound('Case not found.');
    assertCampaignAccess(scope, caseRecord.campaign_id as string);

    // Per-record validation: the intent must belong to this case.
    const { data: intent, error: intentError } = await admin
      .from('payment_intents')
      .select('id,case_id,payment_state,expected_amount')
      .eq('id', body.payment_intent_id)
      .maybeSingle();
    if (intentError) throw new Error(`Failed to load payment intent: ${intentError.message}`);
    if (!intent || intent.case_id !== id) {
      return notFound('Payment intent not found for this case.');
    }

    // Stale-screen guard: refuse if the state moved since it was rendered.
    if (intent.payment_state !== body.expected_payment_state) {
      return conflict(
        `This payment has moved to "${intent.payment_state}" since the page was loaded. Reload and review it again.`,
      );
    }

    const priorState = intent.payment_state as PaymentState;

    if (body.action === 'verify_payment') {
      const { data: evidence, error: evidenceError } = await admin
        .from('payment_evidence')
        .select('id,payment_intent_id,amount_confirmed')
        .eq('id', body.evidence_id)
        .maybeSingle();
      if (evidenceError) throw new Error(`Failed to load evidence: ${evidenceError.message}`);
      if (!evidence || evidence.payment_intent_id !== body.payment_intent_id) {
        return notFound('Evidence not found for this payment intent.');
      }

      const nextState: PaymentState = 'verified_by_official_source';
      validatePaymentTransition(priorState, nextState);

      const { error: updateError } = await admin
        .from('payment_intents')
        .update({ payment_state: nextState })
        .eq('id', intent.id)
        .eq('payment_state', priorState);
      if (updateError) throw new Error(`Failed to verify payment: ${updateError.message}`);

      const { error: evidenceUpdateError } = await admin
        .from('payment_evidence')
        .update({
          is_verified: true,
          confirmed_at: new Date().toISOString(),
          confirmed_by: scope.userId,
        })
        .eq('id', evidence.id);
      if (evidenceUpdateError) {
        throw new Error(`Failed to record evidence confirmation: ${evidenceUpdateError.message}`);
      }

      // Mirror onto the case's payment state machine only.
      const { error: caseUpdateError } = await admin
        .from('recipient_cases')
        .update({ payment_state: nextState })
        .eq('id', id);
      if (caseUpdateError) {
        throw new Error(`Failed to update case payment state: ${caseUpdateError.message}`);
      }

      await writeAuditEvent({
        event_type: 'payment_status_change',
        actor_id: scope.userId,
        actor_type: 'user',
        action: 'Verified payment evidence',
        target_type: 'payment_intent',
        target_id: intent.id as string,
        case_id: id,
        campaign_id: caseRecord.campaign_id as string,
        details: {
          prior_state: priorState,
          resulting_state: nextState,
          evidence_id: evidence.id,
          reason: 'Evidence matched the expected payment.',
          membership_unchanged: caseRecord.membership_state,
        },
        severity: 'warning',
      });

      return NextResponse.json(
        {
          paymentState: nextState,
          priorState,
          // Restated in the response so a client cannot infer activation.
          membershipState: caseRecord.membership_state,
          membershipChanged: false,
        },
        { headers: PRIVATE_NO_STORE },
      );
    }

    // Requesting replacement evidence is the defined retry path, not a
    // self-transition: the current attempt is cancelled and the official
    // handoff is reopened so the payer can supply new evidence. Both
    // steps are validated against the payment state machine.
    const cancelledState: PaymentState = 'failed_or_cancelled';
    const nextState: PaymentState = 'official_handoff_opened';
    validatePaymentTransition(priorState, cancelledState);
    validatePaymentTransition(cancelledState, nextState);

    const { error: updateError } = await admin
      .from('payment_intents')
      .update({ payment_state: nextState })
      .eq('id', intent.id)
      .eq('payment_state', priorState);
    if (updateError) throw new Error(`Failed to request replacement: ${updateError.message}`);

    const { error: caseUpdateError } = await admin
      .from('recipient_cases')
      .update({ payment_state: nextState })
      .eq('id', id);
    if (caseUpdateError) {
      throw new Error(`Failed to update case payment state: ${caseUpdateError.message}`);
    }

    await writeAuditEvent({
      event_type: 'payment_status_change',
      actor_id: scope.userId,
      actor_type: 'user',
      action: 'Requested replacement payment evidence',
      target_type: 'payment_intent',
      target_id: intent.id as string,
      case_id: id,
      campaign_id: caseRecord.campaign_id as string,
      details: {
        prior_state: priorState,
        resulting_state: nextState,
        reason: body.reason,
      },
      severity: 'warning',
    });

    return NextResponse.json(
      {
        paymentState: nextState,
        priorState,
        membershipState: caseRecord.membership_state,
        membershipChanged: false,
      },
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error) {
    return handleAdminError(error, 'Admin payment action');
  }
}
