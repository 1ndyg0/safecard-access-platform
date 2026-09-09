const MAX_PAYMENT_PROOF_BYTES = 10 * 1024 * 1024;
const ACCEPTED_PAYMENT_PROOF_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type InitiateResponse = {
  uploadSessionId: string;
  state: 'initiated' | 'completed';
  evidenceVersionId: string | null;
  uploadUrl: string | null;
};

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : 'Proof upload failed.');
  }
  return body;
}

function uploadToSignedStorageUrl(
  uploadUrl: string,
  file: File,
  onProgress: (percentage: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl);
    request.setRequestHeader('x-upsert', 'false');
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 90));
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error('Private receipt upload failed. Please try again.'));
    });
    request.addEventListener('error', () => reject(new Error('The upload was interrupted. Check your connection and try again.')));
    request.addEventListener('abort', () => reject(new Error('The upload was cancelled.')));

    // This matches Supabase Storage's signed-upload protocol while preserving
    // XMLHttpRequest progress events for slow or unstable mobile connections.
    const form = new FormData();
    form.append('cacheControl', '60');
    form.append('', file);
    request.send(form);
  });
}

export async function uploadPaymentEvidence(input: {
  paymentIntentId: string;
  file: File;
  idempotencyKey: string;
  onProgress: (percentage: number) => void;
}) {
  if (!ACCEPTED_PAYMENT_PROOF_TYPES.has(input.file.type)) {
    throw new Error('Only JPEG, PNG, and WebP receipt images are accepted.');
  }
  if (input.file.size < 1 || input.file.size > MAX_PAYMENT_PROOF_BYTES) {
    throw new Error('Receipt image must be between 1 byte and 10 MB.');
  }

  input.onProgress(1);
  const initiation = await fetch('/api/payment/evidence/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payment_intent_id: input.paymentIntentId,
      idempotency_key: input.idempotencyKey,
      content_type: input.file.type,
      size_bytes: input.file.size,
    }),
  });
  const session = await responseJson(initiation) as InitiateResponse;
  if (session.state === 'completed' && session.evidenceVersionId) {
    input.onProgress(100);
    return { evidenceId: session.evidenceVersionId, status: 'exists' };
  }
  if (!session.uploadUrl) throw new Error('Secure upload URL was not returned.');

  await uploadToSignedStorageUrl(session.uploadUrl, input.file, input.onProgress);
  input.onProgress(92);
  const finalization = await fetch('/api/payment/evidence/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upload_session_id: session.uploadSessionId }),
  });
  const result = await responseJson(finalization);
  input.onProgress(100);
  return result;
}
