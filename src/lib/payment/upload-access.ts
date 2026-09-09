import 'server-only';

import { AuthError, getAuthContext } from '@/lib/auth/session';
import { requireMemberSession } from '@/lib/auth/member-session';
import { requirePaymentAccess } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';

export async function resolvePaymentUploaderId(paymentIntentId: string): Promise<string> {
  const auth = await getAuthContext();
  if (auth) {
    const access = await requirePaymentAccess(auth.userId, paymentIntentId);
    if (!access.allowed) throw new Error(`Permission denied: ${access.reason ?? 'payment access required'}`);
    return auth.userId;
  }

  let memberCaseId: string;
  try {
    memberCaseId = (await requireMemberSession()).caseId;
  } catch {
    throw new AuthError('Authentication required.');
  }

  const { data: intent, error } = await getSupabaseAdminClient()
    .from('payment_intents')
    .select('case_id,recipient_cases!inner(auth_user_id)')
    .eq('id', paymentIntentId)
    .maybeSingle();
  if (error || !intent) throw new Error('Payment intent not found');
  if (intent.case_id !== memberCaseId) {
    throw new Error('Permission denied: this payment does not belong to the signed-in application.');
  }
  const recipient = Array.isArray(intent.recipient_cases)
    ? intent.recipient_cases[0]
    : intent.recipient_cases;
  if (!recipient?.auth_user_id) {
    throw new Error('Cannot upload evidence because the application does not have an authenticated owner.');
  }
  return recipient.auth_user_id;
}
