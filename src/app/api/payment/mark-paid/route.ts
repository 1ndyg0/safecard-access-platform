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

/** The reference field is optional in the wizard now — proof-of-payment upload alone is
 *  enough for staff review. The underlying RPC still requires a non-empty reference for
 *  its idempotency check, so mint a deterministic internal one from the intent id when
 *  the client did not supply a bank/GCash reference. */
function ensurePaymentReference(clientRef: string, intentId: string): string {
  const trimmed = clientRef.trim();
  if (trimmed.length > 0) return trimmed;
  return `PROOF-${intentId.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'payment.mark-paid');
    const body = await request.json();
    const parsed = markPaymentPaidSchema.parse(body);

    const auth = await requireAuth();
    const access = await requirePaymentAccess(auth.userId, parsed.payment_intent_id);
    if (!access.allowed) throw new Error('Permission denied: payment access required');
    // Assert on the user-supplied reference before we auto-mint one — the safety check is
    // about what the caller typed, not about our own internal PROOF-XXXX id.
    assertSyntheticText(parsed.data_mode, parsed.payment_reference);
    const paymentReference = ensurePaymentReference(parsed.payment_reference, parsed.payment_intent_id);

    await markPaymentPaid(
      parsed.payment_intent_id,
      paymentReference,
      parsed.payer_declaration,
      auth.userId,
    );

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
