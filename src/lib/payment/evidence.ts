import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdminClient } from '@/lib/db/client';
export * from './evidence-validation';
import { buildPaymentProofObjectPath, validatePaymentProof } from './evidence-validation';

export async function storePaymentProof(input: {
  campaignId: string;
  caseId: string;
  paymentIntentId: string;
  referenceNumber?: string;
  amount: number;
  buffer: Buffer;
  claimedMimeType: string;
  uploadedBy: string;
}) {
  const proof = validatePaymentProof(input.buffer, input.claimedMimeType);
  const evidenceId = uuidv4();
  const admin = getSupabaseAdminClient();
  const bucket = process.env.PAYMENT_PROOFS_BUCKET ?? 'payment-proofs';
  const { data: intent, error: intentError } = await admin
    .from('payment_intents')
    .select('case_id,campaign_id,expected_amount,state')
    .eq('id', input.paymentIntentId)
    .single();
  if (intentError || !intent) throw new Error('Payment intent not found');
  if (intent.case_id !== input.caseId || intent.campaign_id !== input.campaignId) throw new Error('Payment evidence does not match the application case.');
  if (Number(intent.expected_amount) !== input.amount) throw new Error('Payment evidence amount does not match the payment intent.');
  const objectPath = buildPaymentProofObjectPath(input.campaignId, input.caseId, input.paymentIntentId, evidenceId, proof.extension);
  const upload = await admin.storage.from(bucket).upload(objectPath, input.buffer, {
    contentType: proof.mimeType,
    cacheControl: '60',
    upsert: false,
  });
  if (upload.error) throw new Error(`Receipt upload failed: ${upload.error.message}`);

  const { data: registered, error: registrationError } = await admin.rpc(
    'register_payment_evidence_atomic',
    {
      p_evidence_id: evidenceId,
      p_payment_intent_id: input.paymentIntentId,
      p_case_id: input.caseId,
      p_campaign_id: input.campaignId,
      p_reference_number: input.referenceNumber ?? null,
      p_amount: input.amount,
      p_object_path: objectPath,
      p_content_type: proof.mimeType,
      p_file_size_bytes: proof.sizeBytes,
      p_sha256: proof.sha256,
      p_image_width: proof.width,
      p_image_height: proof.height,
      p_uploaded_by: input.uploadedBy,
    },
  );
  if (registrationError || !registered) {
    await admin.storage.from(bucket).remove([objectPath]);
    throw new Error(
      `Receipt metadata could not be saved: ${registrationError?.message ?? 'unknown error'}`,
    );
  }

  return { evidenceId, objectPath, ...proof, state: 'verification_pending' as const };
}
