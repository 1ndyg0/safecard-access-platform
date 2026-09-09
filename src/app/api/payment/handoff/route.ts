/**
 * POST /api/payment/handoff
 *
 * Create a payment intent (official handoff).
 * Returns the approved external PRC payment handoff instructions.
 *
 * Payment does NOT activate membership.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent } from '@/lib/payment';
import { createPaymentIntentSchema } from '@/lib/validation/schemas';
import { requireAuth } from '@/lib/auth/session';
import { requireCaseOwnership } from '@/lib/auth/permissions';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { assertSyntheticText } from '@/lib/safety/data-mode';
import { handleApiError } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'payment.handoff');
    const body = await request.json();
    const parsed = createPaymentIntentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const auth = await requireAuth();
    const ownership = await requireCaseOwnership(auth.userId, parsed.data.case_id);
    if (!ownership.allowed) {
      return NextResponse.json({ error: ownership.reason }, { status: 403 });
    }
    assertSyntheticText(parsed.data.data_mode, parsed.data.payer_name);

    const result = await createPaymentIntent({
      caseId: parsed.data.case_id,
      campaignId: parsed.data.campaign_id,
      payerType: parsed.data.payer_type,
      payerName: parsed.data.payer_name,
      payerSponsorId: parsed.data.payer_sponsor_id,
      expectedAmount: parsed.data.expected_amount,
      paymentRoute: parsed.data.payment_route,
      idempotencyKey: parsed.data.idempotency_key,
      actorId: auth.userId,
    });

    return NextResponse.json(
      {
        paymentIntentId: result.paymentIntentId,
        status: result.status,
        message: 'Use the official PRC payment route. Payment is pending until verified.',
        warning: 'Payment does not activate membership. PRC confirmation is required.',
      },
      { status: result.status === 'created' ? 201 : 200 }
    );
  } catch (error) {
    return handleApiError(error, 'Payment handoff');
  }
}
