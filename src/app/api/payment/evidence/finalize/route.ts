import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { handleApiError } from '@/lib/api/response';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { finalizePaymentProofUpload } from '@/lib/payment/evidence';
import { resolvePaymentUploaderId } from '@/lib/payment/upload-access';

export const runtime = 'nodejs';

const schema = z.object({ upload_session_id: z.string().uuid() }).strict();

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'payment.evidence.finalize');
    const parsed = schema.parse(await request.json());

    // Resolve all ownership context from the server-owned session. The browser
    // never supplies case, campaign, payment amount, or storage path values.
    const { data: session, error } = await getSupabaseAdminClient()
      .from('payment_upload_sessions')
      .select('payment_intent_id')
      .eq('id', parsed.upload_session_id)
      .maybeSingle();
    if (error || !session) throw new Error('Payment upload session not found');

    const uploaderUserId = await resolvePaymentUploaderId(session.payment_intent_id);
    const result = await finalizePaymentProofUpload({
      uploadSessionId: parsed.upload_session_id,
      uploaderUserId,
    });
    return NextResponse.json({
      ...result,
      message: 'Proof received for staff verification. Payment does not activate membership.',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return handleApiError(error, 'Payment proof upload finalization');
  }
}
