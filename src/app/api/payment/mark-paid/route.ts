/**
 * POST /api/payment/mark-paid
 *
 * Payer marks payment as completed with a reference number.
 * This does NOT verify the payment — verification comes from
 * GCash callback or manual staff reconciliation.
 *
 * Journey phase 5: "I paid" reconciliation
 */

import { NextRequest } from 'next/server';
import { markPaymentPaid } from '@/lib/payment';
import { markPaymentPaidSchema } from '@/lib/validation/schemas';
import { success, handleApiError } from '@/lib/api/response';
import { requireAuth } from '@/lib/auth/session';
import { requirePaymentAccess } from '@/lib/auth/permissions';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { assertSyntheticText } from '@/lib/safety/data-mode';

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'payment.mark-paid');
    const body = await request.json();
    const parsed = markPaymentPaidSchema.parse(body);

    const auth = await requireAuth();
    const access = await requirePaymentAccess(auth.userId, parsed.payment_intent_id);
    if (!access.allowed) throw new Error('Permission denied: payment access required');
    const dataMode = process.env.LAUNCH_GATES_COMPLETE === 'true' && process.env.NEXT_PUBLIC_DATA_MODE === 'live'
      ? 'live'
      : 'synthetic';
    assertSyntheticText(dataMode, parsed.payment_reference);

    await markPaymentPaid(parsed.payment_intent_id, parsed.payment_reference, auth.userId);

    return success({
      marked: true,
      message: 'Payment marked as paid. Verification is pending.',
      message_tl: 'Na-mark na bilang bayad. Naghihintay pa ng verification.',
      warning: 'Your membership is not yet active. PRC must confirm it.',
    });
  } catch (error) {
    return handleApiError(error, 'Mark payment paid');
  }
}
