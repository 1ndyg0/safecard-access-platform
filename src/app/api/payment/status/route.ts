/**
 * GET /api/payment/status?case_id=xxx
 *
 * Payment status for a case.
 * Accessible by case owner and linked sponsor.
 * Returns payment state, reference, and verification status.
 * Always reminds: payment does NOT equal active membership.
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { success, badRequest, forbidden, handleApiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const caseId = request.nextUrl.searchParams.get('case_id');

    if (!caseId) return badRequest('case_id is required');

    const admin = getSupabaseAdminClient();

    // Verify access — case owner OR linked sponsor
    const { data: caseRecord } = await admin
      .from('recipient_cases')
      .select('auth_user_id, payment_state, referral_link_id')
      .eq('id', caseId)
      .single();

    if (!caseRecord) return badRequest('Case not found');

    let hasAccess = caseRecord.auth_user_id === auth.userId;

    if (!hasAccess && caseRecord.referral_link_id) {
      const { data: link } = await admin
        .from('referral_links')
        .select('sponsors!inner(auth_user_id)')
        .eq('id', caseRecord.referral_link_id)
        .maybeSingle();

      const sponsor = link?.sponsors as { auth_user_id?: string } | { auth_user_id?: string }[] | null;
      const sponsorOwner = Array.isArray(sponsor) ? sponsor[0] : sponsor;
      hasAccess = sponsorOwner?.auth_user_id === auth.userId;
    }

    if (!hasAccess) return forbidden('You do not have access to this payment status');

    // Get payment intents for this case
    const { data: intents } = await admin
      .from('payment_intents')
      .select(`
        id, state, payer_type, expected_amount, currency,
        payment_route, payment_reference,
        handoff_opened_at, payer_marked_paid_at, verified_at, failed_at
      `)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    const isRecipient = caseRecord.auth_user_id === auth.userId;
    const visibleIntents = (intents ?? []).map((intent) => isRecipient ? intent : ({
      id: intent.id,
      state: intent.state,
      expected_amount: intent.expected_amount,
      currency: intent.currency,
      payment_route: intent.payment_route,
      handoff_opened_at: intent.handoff_opened_at,
      payer_marked_paid_at: intent.payer_marked_paid_at,
      verified_at: intent.verified_at,
      failed_at: intent.failed_at,
    }));

    return success({
      caseId,
      paymentState: caseRecord.payment_state,
      intents: visibleIntents,
      warning: 'Payment does not activate membership. PRC confirmation is required.',
      warning_tl: 'Ang pagbayad ay hindi nangangahulugang aktibo ang membership. Kailangan ang PRC confirmation.',
    });
  } catch (error) {
    return handleApiError(error, 'Payment status');
  }
}
