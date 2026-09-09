/** Member-session payment-proof replacement. The case id is never accepted from the browser. */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireMemberSession } from '@/lib/auth/member-session';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { handleApiError } from '@/lib/api/response';
import { assertSyntheticText, resolveDataMode } from '@/lib/safety/data-mode';
import { storePaymentProof } from '@/lib/payment/evidence';

export const dynamic = 'force-dynamic';

const fieldsSchema = z.strictObject({
  reference_number: z.string().trim().max(120).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await enforceRateLimit(request, 'member.payment.evidence');
    const { caseId } = await requireMemberSession();
    const form = await request.formData();
    const parsed = fieldsSchema.parse({
      reference_number: String(form.get('reference_number') ?? '').trim() || undefined,
    });
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A replacement receipt image is required.' }, { status: 400 });
    }

    const dataMode = resolveDataMode();
    assertSyntheticText(dataMode, parsed.reference_number);
    const admin = getSupabaseAdminClient();
    const { data: caseRecord, error: caseError } = await admin
      .from('recipient_cases')
      .select('id,campaign_id,auth_user_id')
      .eq('id', caseId)
      .maybeSingle();
    if (caseError || !caseRecord?.auth_user_id) {
      throw new Error('Application payment identity is unavailable');
    }

    const { data: intent, error: intentError } = await admin
      .from('payment_intents')
      .select('id,expected_amount,payment_reference,state')
      .eq('case_id', caseId)
      .eq('state', 'verification_pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (intentError || !intent) throw new Error('No payment is awaiting replacement evidence');

    const { data: currentEvidence } = await admin
      .from('payment_evidence_versions')
      .select('id,state')
      .eq('payment_intent_id', intent.id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (currentEvidence?.state !== 'reupload_requested') {
      throw new Error('Replacement payment evidence has not been requested');
    }

    const result = await storePaymentProof({
      campaignId: caseRecord.campaign_id as string,
      caseId,
      paymentIntentId: intent.id as string,
      referenceNumber: parsed.reference_number ?? intent.payment_reference ?? undefined,
      amount: Number(intent.expected_amount),
      buffer: Buffer.from(await file.arrayBuffer()),
      claimedMimeType: file.type,
      uploadedBy: caseRecord.auth_user_id as string,
    });

    return NextResponse.json(
      {
        evidenceId: result.evidenceId,
        state: result.state,
        message: 'Replacement proof received. Official verification is still required.',
      },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return handleApiError(error, 'Member payment-proof replacement');
  }
}
