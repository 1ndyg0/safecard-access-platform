import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { handleApiError } from '@/lib/api/response';
import { beginPaymentProofUpload, PAYMENT_PROOF_MAX_BYTES } from '@/lib/payment/evidence';
import { resolvePaymentUploaderId } from '@/lib/payment/upload-access';

export const runtime = 'nodejs';

const schema = z.object({
  payment_intent_id: z.string().uuid(),
  idempotency_key: z.string().min(16).max(128),
  content_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size_bytes: z.number().int().min(1).max(PAYMENT_PROOF_MAX_BYTES),
}).strict();

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'payment.evidence.initiate');
    const parsed = schema.parse(await request.json());
    const uploaderUserId = await resolvePaymentUploaderId(parsed.payment_intent_id);
    const session = await beginPaymentProofUpload({
      paymentIntentId: parsed.payment_intent_id,
      uploaderUserId,
      idempotencyKey: parsed.idempotency_key,
      claimedMimeType: parsed.content_type,
      declaredSizeBytes: parsed.size_bytes,
    });
    return NextResponse.json(session, {
      status: session.state === 'completed' ? 200 : 201,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return handleApiError(error, 'Payment proof upload initiation');
  }
}
