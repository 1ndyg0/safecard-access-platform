import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { writeAuditEvent } from '@/lib/audit';
import { handleApiError } from '@/lib/api/response';

const schema = z.object({ evidence_version_id: z.string().uuid(), reason: z.string().trim().min(5).max(500) });

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();
    const parsed = schema.parse(await request.json());
    const admin = getSupabaseAdminClient();
    const { data: evidence } = await admin.from('payment_evidence_versions').select('id, payment_intent_id, payment_intents!inner(case_id,campaign_id)').eq('id', parsed.evidence_version_id).maybeSingle();
    if (!evidence) return NextResponse.json({ error: 'Evidence not found.' }, { status: 404 });
    const paymentIntent = Array.isArray(evidence.payment_intents) ? evidence.payment_intents[0] : evidence.payment_intents;
    const access = await requireAnyRole(auth.userId, ['privacy_admin_owner', 'school_admin', 'finance_export', 'prc_liaison'], paymentIntent.campaign_id);
    if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: 403 });
    const { error } = await admin.from('payment_evidence_versions').update({ state: 'reupload_requested', reviewed_by: auth.userId, reviewed_at: new Date().toISOString(), metadata: { reupload_reason: parsed.reason } }).eq('id', parsed.evidence_version_id);
    if (error) throw new Error(`Evidence could not be marked for replacement: ${error.message}`);
    await writeAuditEvent({ event_type: 'payment_status_change', actor_id: auth.userId, actor_type: 'user', action: 'Requested replacement payment evidence', case_id: paymentIntent.case_id, target_type: 'payment_evidence_version', target_id: parsed.evidence_version_id, details: { reason: parsed.reason } });
    return NextResponse.json({ requested: true, state: 'reupload_requested' });
  } catch (error) {
    return handleApiError(error, 'Payment proof replacement request');
  }
}
