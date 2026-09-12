import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { handleApiError } from '@/lib/api/response';

const schema = z.strictObject({
  evidence_version_id: z.string().uuid(),
  reason: z.string().trim().min(10).max(500),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();
    const parsed = schema.parse(await request.json());
    const admin = getSupabaseAdminClient();
    const { data: evidence } = await admin.from('payment_evidence_versions').select('id, payment_intent_id, payment_intents!inner(case_id,campaign_id,state)').eq('id', parsed.evidence_version_id).maybeSingle();
    if (!evidence) return NextResponse.json({ error: 'Evidence not found.' }, { status: 404 });
    const paymentIntent = Array.isArray(evidence.payment_intents) ? evidence.payment_intents[0] : evidence.payment_intents;
    const access = await requireAnyRole(auth.userId, ['privacy_admin_owner', 'school_admin', 'finance_export', 'prc_liaison'], paymentIntent.campaign_id);
    if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: 403 });
    const { error } = await admin.rpc('request_payment_evidence_reupload_atomic', {
      p_payment_intent_id: evidence.payment_intent_id,
      p_evidence_version_id: parsed.evidence_version_id,
      p_requested_by: auth.userId,
      p_reason: parsed.reason,
      p_expected_state: paymentIntent.state,
    });
    if (error) throw new Error(`Evidence could not be marked for replacement: ${error.message}`);
    return NextResponse.json({ requested: true, state: 'reupload_requested' });
  } catch (error) {
    return handleApiError(error, 'Payment proof replacement request');
  }
}
