import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { handleApiError } from '@/lib/api/response';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireStaffAuth();
    const { id } = await context.params;
    const admin = getSupabaseAdminClient();
    const { data: evidence } = await admin
      .from('payment_evidence_versions')
      .select('id, payment_intent_id, object_path, content_type, state, payment_intents!inner(campaign_id)')
      .eq('id', id)
      .maybeSingle();
    if (!evidence) return NextResponse.json({ error: 'Evidence not found.' }, { status: 404 });
    const paymentIntent = Array.isArray(evidence.payment_intents) ? evidence.payment_intents[0] : evidence.payment_intents;
    const access = await requireAnyRole(auth.userId, ['privacy_admin_owner', 'school_admin', 'finance_export', 'prc_liaison'], paymentIntent.campaign_id);
    if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: 403 });
    const bucket = process.env.PAYMENT_PROOFS_BUCKET ?? 'payment-proofs';
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(evidence.object_path, 300);
    if (error || !data?.signedUrl) return NextResponse.json({ error: 'Evidence is temporarily unavailable.' }, { status: 503 });
    return NextResponse.json({ signedUrl: data.signedUrl, expiresInSeconds: 300, contentType: evidence.content_type }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return handleApiError(error, 'Payment evidence signed URL');
  }
}
