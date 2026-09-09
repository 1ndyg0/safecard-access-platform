import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { handleApiError } from '@/lib/api/response';

const schema = z.object({ evidence_version_id: z.string().uuid(), reason: z.string().trim().min(5).max(500) });

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();
    const parsed = schema.parse(await request.json());
    const admin = getSupabaseAdminClient();
    const { data: evidence } = await admin.from('payment_evidence_versions').select('id, payment_intent_id, state, payment_intents!inner(case_id,campaign_id)').eq('id', parsed.evidence_version_id).maybeSingle();
    if (!evidence) return NextResponse.json({ error: 'Evidence not found.' }, { status: 404 });
    const paymentIntent = Array.isArray(evidence.payment_intents) ? evidence.payment_intents[0] : evidence.payment_intents;
    const access = await requireAnyRole(auth.userId, ['privacy_admin_owner', 'school_admin', 'finance_export', 'prc_liaison'], paymentIntent.campaign_id);
    if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: 403 });
    if (evidence.state !== 'verification_pending') return NextResponse.json({ error: 'Only pending evidence can be returned for replacement.' }, { status: 409 });
    const { error } = await admin.rpc('request_payment_evidence_reupload', {
      p_evidence_version_id: parsed.evidence_version_id,
      p_reviewed_by: auth.userId,
      p_reason: parsed.reason,
    });
    if (error) throw new Error(`Evidence could not be marked for replacement atomically: ${error.message}`);
    return NextResponse.json({ requested: true, state: 'reupload_requested' });
  } catch (error) {
    return handleApiError(error, 'Payment proof replacement request');
  }
}
