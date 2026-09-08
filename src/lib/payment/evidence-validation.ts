import { createHash } from 'node:crypto';

export const PAYMENT_PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const PAYMENT_PROOF_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PaymentProofMimeType = (typeof PAYMENT_PROOF_MIME_TYPES)[number];

export class PaymentProofValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProofValidationError';
  }
}

export interface ValidatedPaymentProof {
  mimeType: PaymentProofMimeType;
  extension: 'jpg' | 'png' | 'webp';
  sizeBytes: number;
  sha256: string;
  width: number | null;
  height: number | null;
}

function isPng(buffer: Buffer) {
  return buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

function isJpeg(buffer: Buffer) {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isWebp(buffer: Buffer) {
  return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
}

function dimensions(buffer: Buffer, mimeType: PaymentProofMimeType) {
  if (mimeType === 'image/png' && isPng(buffer)) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (mimeType === 'image/jpeg' && isJpeg(buffer)) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2 || offset + length + 2 > buffer.length) break;
      if (marker >= 0xc0 && marker <= 0xc3) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      offset += length + 2;
    }
  }
  return { width: null, height: null };
}

export function validatePaymentProof(buffer: Buffer, claimedMimeType: string): ValidatedPaymentProof {
  if (!PAYMENT_PROOF_MIME_TYPES.includes(claimedMimeType as PaymentProofMimeType)) throw new PaymentProofValidationError('Only JPEG, PNG, and WebP receipt images are accepted.');
  if (buffer.length === 0 || buffer.length > PAYMENT_PROOF_MAX_BYTES) throw new PaymentProofValidationError('Receipt image must be between 1 byte and 10 MB.');
  const mimeType = claimedMimeType as PaymentProofMimeType;
  const signatureMatches = (mimeType === 'image/png' && isPng(buffer)) || (mimeType === 'image/jpeg' && isJpeg(buffer)) || (mimeType === 'image/webp' && isWebp(buffer));
  if (!signatureMatches) throw new PaymentProofValidationError('The file signature does not match the claimed image type.');
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
  const size = dimensions(buffer, mimeType);
  return { mimeType, extension, sizeBytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex'), width: size.width, height: size.height };
}

export function buildPaymentProofObjectPath(campaignId: string, caseId: string, paymentIntentId: string, evidenceId: string, extension: string) {
  return `campaigns/${campaignId}/cases/${caseId}/payments/${paymentIntentId}/evidence/${evidenceId}.${extension}`;
}
