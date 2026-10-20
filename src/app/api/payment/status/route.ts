/**
 * GET /api/payment/status?case_id=xxx
 *
 * Payment status for a case.
 * Accessible by the case owner.
 * Returns payment state, reference, and verification status.
 * Payment is verified by an administrator as part of approving the application.
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

    // Verify access — case owner only
    const { data: caseRecord } = await admin
      .from('recipient_cases')
      .select('auth_user_id, payment_state')
      .eq('id', caseId)
      .single();

    if (!caseRecord) return badRequest('Case not found');

    if (caseRecord.auth_user_id !== auth.userId) return forbidden('You do not have access to this payment status');

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

    return success({
      caseId,
      paymentState: caseRecord.payment_state,
      intents: intents ?? [],
    });
  } catch (error) {
    return handleApiError(error, 'Payment status');
  }
}
