import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { writeAuditEvent } from '@/lib/audit';
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
  const { data: previousVersion } = await admin
    .from('payment_evidence_versions')
    .select('id,version_number,state')
    .eq('payment_intent_id', input.paymentIntentId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const upload = await admin.storage.from(bucket).upload(objectPath, input.buffer, {
    contentType: proof.mimeType,
    cacheControl: '60',
    upsert: false,
  });
  if (upload.error) throw new Error(`Receipt upload failed: ${upload.error.message}`);

  const { data: evidence, error: evidenceError } = await admin
    .from('payment_evidence')
    .insert({
      id: evidenceId,
      payment_intent_id: input.paymentIntentId,
      evidence_type: 'manual_receipt_reference',
      reference_number: input.referenceNumber ?? null,
      amount_confirmed: input.amount,
      currency: 'PHP',
      source: 'payer_upload',
      is_verified: false,
      metadata: { upload_metadata_only: true },
    })
    .select('id')
    .single();
  if (evidenceError || !evidence) {
    await admin.storage.from(bucket).remove([objectPath]);
    throw new Error(`Receipt metadata could not be saved: ${evidenceError?.message ?? 'unknown error'}`);
  }

  const { error: versionError } = await admin.from('payment_evidence_versions').insert({
    id: evidenceId,
    payment_evidence_id: evidence.id,
    payment_intent_id: input.paymentIntentId,
    version_number: (previousVersion?.version_number ?? 0) + 1,
    object_path: objectPath,
    content_type: proof.mimeType,
    file_size_bytes: proof.sizeBytes,
    sha256: proof.sha256,
    image_width: proof.width,
    image_height: proof.height,
    state: 'verification_pending',
    uploaded_by: input.uploadedBy,
    supersedes_id: previousVersion?.id ?? null,
    metadata: { original_filename_omitted: true },
  });
  if (versionError) {
    await admin.storage.from(bucket).remove([objectPath]);
    throw new Error(`Receipt version could not be saved: ${versionError.message}`);
  }

  if (previousVersion && previousVersion.state !== 'superseded') {
    await admin.from('payment_evidence_versions').update({ state: 'superseded' }).eq('id', previousVersion.id);
  }

  if (intent.state === 'payer_marked_paid') {
    await admin.from('payment_intents').update({ state: 'verification_pending', verification_started_at: new Date().toISOString() }).eq('id', input.paymentIntentId);
    await admin.from('recipient_cases').update({ payment_state: 'verification_pending' }).eq('id', input.caseId);
  }

  await writeAuditEvent({
    event_type: 'payment_status_change',
    actor_id: input.uploadedBy,
    actor_type: 'user',
    action: `Uploaded payment evidence version ${evidenceId}`,
    case_id: input.caseId,
    target_type: 'payment_evidence_version',
    target_id: evidenceId,
    details: { content_type: proof.mimeType, size_bytes: proof.sizeBytes, sha256: proof.sha256 },
  });

  return { evidenceId, objectPath, ...proof, state: 'verification_pending' as const };
}
