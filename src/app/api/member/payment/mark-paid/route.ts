/**
 * POST /api/member/payment/mark-paid
 *
 * Lets a passwordless member session report an off-platform payment without
 * exposing or trusting a payment-intent id from the browser. The signed member
 * cookie supplies the case id; the server resolves that case's current payable
 * intent and applies only the payment-state transition.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireMemberSession } from '@/lib/auth/member-session';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { handleApiError, conflict } from '@/lib/api/response';
import { assertSyntheticText, resolveDataMode } from '@/lib/safety/data-mode';
import { markPaymentPaid } from '@/lib/payment';

export const dynamic = 'force-dynamic';

const bodySchema = z.strictObject({
  payment_reference: z.string().trim().min(1).max(100),
  confirm: z.literal(true),
});

const PAYER_DECLARATION =
  'I confirm that this transfer was completed outside SafeCard and understand that payment verification does not activate membership.';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Enter the official transaction reference and confirm the declaration.' },
        { status: 400 },
      );
    }

    await enforceRateLimit(request, 'member.payment.mark-paid');
    const { caseId } = await requireMemberSession();
    const dataMode = resolveDataMode();
    assertSyntheticText(dataMode, parsed.data.payment_reference);

    const admin = getSupabaseAdminClient();
    const { data: intent, error } = await admin
      .from('payment_intents')
      .select('id,state')
      .eq('case_id', caseId)
      .eq('state', 'official_handoff_opened')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Payment intent could not be loaded: ${error.message}`);
    if (!intent) {
      return conflict('No payment is currently waiting for a transaction reference.');
    }

    await markPaymentPaid(
      intent.id as string,
      parsed.data.payment_reference,
      PAYER_DECLARATION,
      null,
    );

    return NextResponse.json(
      {
        marked: true,
        paymentState: 'payer_marked_paid',
        membershipChanged: false,
        message: 'Transaction reference saved. Official verification is still required.',
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return handleApiError(error, 'Member payment declaration');
  }
}
