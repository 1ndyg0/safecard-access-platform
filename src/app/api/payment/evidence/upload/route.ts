import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/session';
import { requirePaymentAccess } from '@/lib/auth/permissions';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { assertSyntheticText } from '@/lib/safety/data-mode';
import { handleApiError } from '@/lib/api/response';
import { storePaymentProof } from '@/lib/payment/evidence';

const fieldsSchema = z.object({
  payment_intent_id: z.string().uuid(),
  case_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  reference_number: z.string().trim().max(120).optional(),
  payer_declaration: z.string().trim().min(10).max(500),
  data_mode: z.enum(['synthetic', 'live']).default('synthetic'),
});

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'payment.evidence.upload');
    const form = await request.formData();
    const parsed = fieldsSchema.parse(Object.fromEntries(form.entries()));
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'A receipt image or PDF is required.' }, { status: 400 });

    const auth = await requireAuth();
    const access = await requirePaymentAccess(auth.userId, parsed.payment_intent_id);
    if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: 403 });
    assertSyntheticText(parsed.data_mode, parsed.reference_number);
    assertSyntheticText(parsed.data_mode, parsed.payer_declaration);

    const result = await storePaymentProof({
      campaignId: parsed.campaign_id,
      caseId: parsed.case_id,
      paymentIntentId: parsed.payment_intent_id,
      referenceNumber: parsed.reference_number,
      amount: parsed.amount,
      buffer: Buffer.from(await file.arrayBuffer()),
      claimedMimeType: file.type,
      uploadedBy: auth.userId,
    });

    return NextResponse.json({
      evidenceId: result.evidenceId,
      state: result.state,
      message: 'Proof received for staff verification. Payment does not activate membership.',
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error, 'Payment proof upload');
  }
}
