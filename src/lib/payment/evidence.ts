import 'server-only';

import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { canonicalJson } from '@/lib/canonical-json';
import { assertSyntheticText } from '@/lib/safety/data-mode';
export * from './evidence-validation';
import {
  buildPaymentProofObjectPath,
  PAYMENT_PROOF_MAX_BYTES,
  PaymentProofValidationError,
  validatePaymentProof,
} from './evidence-validation';

const UPLOAD_SESSION_MINUTES = 110;
const PAYMENT_PROOFS_BUCKET = process.env.PAYMENT_PROOFS_BUCKET ?? 'payment-proofs';

type UploadSessionRow = {
  session_id: string;
  payment_intent_id?: string;
  case_id?: string;
  campaign_id?: string;
  quarantine_object_path: string;
  claimed_content_type?: string;
  declared_size_bytes?: number;
  upload_state: 'initiated' | 'processing' | 'completed' | 'failed' | 'expired';
  evidence_version_id: string | null;
  expires_at?: string;
};

function firstRow<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function paymentDataMode() {
  return process.env.LAUNCH_GATES_COMPLETE === 'true' && process.env.NEXT_PUBLIC_DATA_MODE === 'live'
    ? 'live' as const
    : 'synthetic' as const;
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  throw new PaymentProofValidationError('Only JPEG, PNG, and WebP receipt images are accepted.');
}

function retentionReviewAt(): string | null {
  const configured = process.env.PAYMENT_EVIDENCE_RETENTION_DAYS;
  if (!configured) return null;
  const days = Number(configured);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw new Error('PAYMENT_EVIDENCE_RETENTION_DAYS must be a whole number from 1 to 3650.');
  }
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export async function beginPaymentProofUpload(input: {
  paymentIntentId: string;
  uploaderUserId: string;
  idempotencyKey: string;
  claimedMimeType: string;
  declaredSizeBytes: number;
}) {
  extensionForMimeType(input.claimedMimeType);
  if (!Number.isInteger(input.declaredSizeBytes) || input.declaredSizeBytes < 1 || input.declaredSizeBytes > PAYMENT_PROOF_MAX_BYTES) {
    throw new PaymentProofValidationError('Receipt image must be between 1 byte and 10 MB.');
  }

  const admin = getSupabaseAdminClient();
  const { data: intent, error: intentError } = await admin
    .from('payment_intents')
    .select('payment_reference')
    .eq('id', input.paymentIntentId)
    .single();
  if (intentError || !intent) throw new Error('Payment intent not found');
  assertSyntheticText(paymentDataMode(), intent.payment_reference ?? undefined);

  const requestHash = createHash('sha256').update(canonicalJson({
    paymentIntentId: input.paymentIntentId,
    uploaderUserId: input.uploaderUserId,
    claimedMimeType: input.claimedMimeType,
    declaredSizeBytes: input.declaredSizeBytes,
  })).digest('hex');
  const sessionId = uuidv4();
  const quarantinePath = `quarantine/payment-evidence/${sessionId}/source.${extensionForMimeType(input.claimedMimeType)}`;
  const expiresAt = new Date(Date.now() + UPLOAD_SESSION_MINUTES * 60_000).toISOString();

  const { data, error } = await admin.rpc('create_payment_upload_session', {
    p_session_id: sessionId,
    p_payment_intent_id: input.paymentIntentId,
    p_uploader_user_id: input.uploaderUserId,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: requestHash,
    p_quarantine_object_path: quarantinePath,
    p_claimed_content_type: input.claimedMimeType,
    p_declared_size_bytes: input.declaredSizeBytes,
    p_expires_at: expiresAt,
  });
  if (error) throw new Error(`Payment upload session could not be created: ${error.message}`);
  const session = firstRow(data as UploadSessionRow | UploadSessionRow[] | null);
  if (!session) throw new Error('Payment upload session could not be created: no result returned');

  if (session.upload_state === 'completed') {
    return {
      uploadSessionId: session.session_id,
      state: session.upload_state,
      evidenceVersionId: session.evidence_version_id,
      uploadUrl: null,
      expiresAt: session.expires_at ?? expiresAt,
    };
  }
  if (session.upload_state !== 'initiated') {
    throw new Error(`Payment upload session is ${session.upload_state}. Start a new upload.`);
  }

  const signed = await admin.storage.from(PAYMENT_PROOFS_BUCKET).createSignedUploadUrl(
    session.quarantine_object_path,
    { upsert: false },
  );
  if (signed.error || !signed.data) {
    await admin
      .from('payment_upload_sessions')
      .update({ state: 'failed', failure_code: 'signed_url_failed' })
      .eq('id', session.session_id)
      .eq('state', 'initiated');
    throw new Error(`Secure upload URL could not be created: ${signed.error?.message ?? 'unknown error'}`);
  }

  return {
    uploadSessionId: session.session_id,
    state: session.upload_state,
    evidenceVersionId: null,
    uploadUrl: signed.data.signedUrl,
    expiresAt: session.expires_at ?? expiresAt,
  };
}

export async function finalizePaymentProofUpload(input: {
  uploadSessionId: string;
  uploaderUserId: string;
}) {
  const admin = getSupabaseAdminClient();
  const { data: claimed, error: claimError } = await admin.rpc('claim_payment_upload_session', {
    p_session_id: input.uploadSessionId,
    p_uploader_user_id: input.uploaderUserId,
  });
  if (claimError) throw new Error(`Payment upload could not be finalized: ${claimError.message}`);
  const session = firstRow(claimed as UploadSessionRow | UploadSessionRow[] | null);
  if (!session) throw new Error('Payment upload could not be finalized: no session returned');
  if (session.upload_state === 'completed' && session.evidence_version_id) {
    return { evidenceId: session.evidence_version_id, state: 'verification_pending' as const, status: 'exists' as const };
  }
  if (
    !session.payment_intent_id || !session.case_id || !session.campaign_id ||
    !session.claimed_content_type || !session.declared_size_bytes
  ) {
    throw new Error('Payment upload session is incomplete.');
  }

  let permanentPath: string | null = null;
  let permanentObjectCreated = false;
  try {
    const download = await admin.storage.from(PAYMENT_PROOFS_BUCKET).download(session.quarantine_object_path);
    if (download.error || !download.data) {
      throw new Error(`Uploaded receipt could not be read: ${download.error?.message ?? 'object missing'}`);
    }
    if (download.data.size !== Number(session.declared_size_bytes)) {
      throw new PaymentProofValidationError('Uploaded receipt size does not match the initiated upload.');
    }
    const buffer = Buffer.from(await download.data.arrayBuffer());
    const proof = await validatePaymentProof(buffer, session.claimed_content_type);
    permanentPath = buildPaymentProofObjectPath(
      session.campaign_id,
      session.case_id,
      session.payment_intent_id,
      session.session_id,
      proof.extension,
    );

    const existing = await admin.storage.from(PAYMENT_PROOFS_BUCKET).exists(permanentPath);
    if (existing.data) {
      const prior = await admin.storage.from(PAYMENT_PROOFS_BUCKET).download(permanentPath);
      if (prior.error || !prior.data) throw new Error('Existing sanitized receipt could not be verified.');
      const priorHash = createHash('sha256').update(Buffer.from(await prior.data.arrayBuffer())).digest('hex');
      if (priorHash !== proof.sha256) throw new Error('Existing receipt object does not match this upload session.');
    } else {
      const upload = await admin.storage.from(PAYMENT_PROOFS_BUCKET).upload(permanentPath, proof.sanitizedBuffer, {
        contentType: proof.mimeType,
        cacheControl: '60',
        upsert: false,
      });
      if (upload.error) throw new Error(`Sanitized receipt could not be stored: ${upload.error.message}`);
      permanentObjectCreated = true;
    }

    const { data: finalized, error: finalizationError } = await admin.rpc('finalize_payment_upload_session', {
      p_session_id: session.session_id,
      p_uploader_user_id: input.uploaderUserId,
      p_object_path: permanentPath,
      p_content_type: proof.mimeType,
      p_file_size_bytes: proof.sizeBytes,
      p_sha256: proof.sha256,
      p_image_width: proof.width,
      p_image_height: proof.height,
      p_retention_review_at: retentionReviewAt(),
    });
    if (finalizationError) throw new Error(`Receipt metadata could not be committed atomically: ${finalizationError.message}`);
    const result = firstRow(finalized as { evidence_id: string; version_number: number; upload_state: string } | Array<{ evidence_id: string; version_number: number; upload_state: string }> | null);
    if (!result) throw new Error('Receipt metadata could not be committed atomically: no result returned');

    const cleanup = await admin.storage.from(PAYMENT_PROOFS_BUCKET).remove([session.quarantine_object_path]);
    if (!cleanup.error) {
      await admin
        .from('payment_upload_sessions')
        .update({ quarantine_deleted_at: new Date().toISOString() })
        .eq('id', session.session_id);
    }

    return {
      evidenceId: result.evidence_id,
      versionNumber: result.version_number,
      state: 'verification_pending' as const,
      status: 'created' as const,
    };
  } catch (error) {
    const permanentFailure = error instanceof PaymentProofValidationError;
    if (permanentObjectCreated && permanentPath) {
      await admin.storage.from(PAYMENT_PROOFS_BUCKET).remove([permanentPath]);
    }
    await admin.rpc('release_payment_upload_session', {
      p_session_id: session.session_id,
      p_uploader_user_id: input.uploaderUserId,
      p_failure_code: permanentFailure ? 'invalid_image' : 'finalization_failed',
      p_permanent_failure: permanentFailure,
    });
    if (permanentFailure) {
      const cleanup = await admin.storage.from(PAYMENT_PROOFS_BUCKET).remove([session.quarantine_object_path]);
      if (!cleanup.error) {
        await admin
          .from('payment_upload_sessions')
          .update({ quarantine_deleted_at: new Date().toISOString() })
          .eq('id', session.session_id);
      }
    }
    throw error;
  }
}

export async function cleanupExpiredPaymentUploads(): Promise<{ removed: number }> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('payment_upload_sessions')
    .select('id,quarantine_object_path')
    .is('quarantine_deleted_at', null)
    .lt('expires_at', new Date().toISOString())
    .limit(100);
  if (error) throw new Error(`Expired payment uploads could not be loaded: ${error.message}`);
  if (!data?.length) return { removed: 0 };

  const paths = data.map((row) => row.quarantine_object_path);
  const removal = await admin.storage.from(PAYMENT_PROOFS_BUCKET).remove(paths);
  if (removal.error) throw new Error(`Expired payment uploads could not be removed: ${removal.error.message}`);
  const ids = data.map((row) => row.id);
  const { error: updateError } = await admin
    .from('payment_upload_sessions')
    .update({ quarantine_deleted_at: new Date().toISOString() })
    .in('id', ids);
  if (updateError) throw new Error(`Expired payment upload records could not be updated: ${updateError.message}`);
  const { error: expireError } = await admin
    .from('payment_upload_sessions')
    .update({ state: 'expired' })
    .in('id', ids)
    .in('state', ['initiated', 'processing']);
  if (expireError) throw new Error(`Expired payment upload states could not be updated: ${expireError.message}`);
  return { removed: ids.length };
}

export async function purgeDuePaymentEvidence(jobId: string): Promise<{ removed: number; enabled: boolean }> {
  if (!process.env.PAYMENT_EVIDENCE_RETENTION_DAYS) return { removed: 0, enabled: false };
  retentionReviewAt();
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('payment_evidence_versions')
    .select('id,object_path')
    .in('state', ['verified', 'rejected', 'superseded'])
    .is('purged_at', null)
    .not('retention_review_at', 'is', null)
    .lte('retention_review_at', new Date().toISOString())
    .limit(50);
  if (error) throw new Error(`Payment evidence retention queue could not be loaded: ${error.message}`);
  let removed = 0;
  for (const row of data ?? []) {
    const removal = await admin.storage.from(PAYMENT_PROOFS_BUCKET).remove([row.object_path]);
    if (removal.error) throw new Error(`Payment evidence ${row.id} could not be purged: ${removal.error.message}`);
    const { error: updateError } = await admin.rpc('record_payment_evidence_purge', {
      p_evidence_version_id: row.id,
      p_job_id: jobId,
    });
    if (updateError) throw new Error(`Payment evidence ${row.id} purge could not be recorded: ${updateError.message}`);
    removed++;
  }
  return { removed, enabled: true };
}
