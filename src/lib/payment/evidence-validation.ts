import { createHash } from 'node:crypto';
import sharp from 'sharp';

export const PAYMENT_PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const PAYMENT_PROOF_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type PaymentProofMimeType = (typeof PAYMENT_PROOF_MIME_TYPES)[number];

export class PaymentProofValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProofValidationError';
  }
}

export interface ValidatedPaymentProof {
  mimeType: PaymentProofMimeType;
  extension: 'jpg' | 'png' | 'webp' | 'pdf';
  sizeBytes: number;
  sha256: string;
  width: number | null;
  height: number | null;
  /** Decoded and re-encoded bytes, with embedded metadata removed. */
  buffer: Buffer;
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

function validatePdf(buffer: Buffer): void {
  const header = buffer.toString('ascii', 0, Math.min(buffer.length, 8));
  if (!/^%PDF-1\.[3-7]/.test(header)) throw new PaymentProofValidationError('The file signature does not match the claimed PDF type.');
  const tail = buffer.toString('latin1', Math.max(0, buffer.length - 2048));
  const body = buffer.toString('latin1');
  if (!tail.includes('%%EOF') || !body.includes('startxref') || !/\/Type\s*\/Page\b/.test(body)) {
    throw new PaymentProofValidationError('The receipt must be a complete PDF document.');
  }
  const forbidden = /\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|XFA|AcroForm|Encrypt)\b/i;
  if (forbidden.test(body)) throw new PaymentProofValidationError('Active, encrypted, embedded, or interactive PDF content is not accepted.');
  const pages = body.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  if (pages < 1 || pages > 10) throw new PaymentProofValidationError('Receipt PDFs must contain between 1 and 10 pages.');
}

export async function validatePaymentProof(buffer: Buffer, claimedMimeType: string): Promise<ValidatedPaymentProof> {
  if (!PAYMENT_PROOF_MIME_TYPES.includes(claimedMimeType as PaymentProofMimeType)) throw new PaymentProofValidationError('Only JPEG, PNG, WebP, and PDF payment evidence is accepted.');
  if (buffer.length === 0 || buffer.length > PAYMENT_PROOF_MAX_BYTES) throw new PaymentProofValidationError('Payment evidence must be between 1 byte and 10 MB.');
  const mimeType = claimedMimeType as PaymentProofMimeType;
  if (mimeType === 'application/pdf') {
    validatePdf(buffer);
    return {
      mimeType,
      extension: 'pdf',
      sizeBytes: buffer.length,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      width: null,
      height: null,
      buffer,
    };
  }
  const signatureMatches = (mimeType === 'image/png' && isPng(buffer)) || (mimeType === 'image/jpeg' && isJpeg(buffer)) || (mimeType === 'image/webp' && isWebp(buffer));
  if (!signatureMatches) throw new PaymentProofValidationError('The file signature does not match the claimed image type.');
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
  const format = mimeType === 'image/jpeg' ? 'jpeg' : extension;
  try {
    // A signature or metadata read alone cannot establish that pixels decode.
    // Bound decompression and reject truncated/corrupt images. Re-encoding also
    // removes EXIF, comments and appended payloads before private storage.
    const decoder = sharp(buffer, { failOn: 'warning', limitInputPixels: 20_000_000 });
    const metadata = await decoder.metadata();
    if (metadata.format !== format || (metadata.pages ?? 1) !== 1) {
      throw new Error('Unsupported receipt image');
    }
    const { data, info } = await decoder.rotate().toFormat(format).toBuffer({ resolveWithObject: true });
    if (data.length > PAYMENT_PROOF_MAX_BYTES) {
      throw new PaymentProofValidationError('Decoded receipt image exceeds 10 MB.');
    }
    return {
      mimeType, extension, sizeBytes: data.length,
      sha256: createHash('sha256').update(data).digest('hex'),
      width: info.width, height: info.height, buffer: data,
    };
  } catch (error) {
    if (error instanceof PaymentProofValidationError) throw error;
    throw new PaymentProofValidationError('The receipt must be a valid, complete image of at most 20 megapixels.');
  }
}

export function buildPaymentProofObjectPath(campaignId: string, caseId: string, paymentIntentId: string, evidenceId: string, extension: string) {
  return `campaigns/${campaignId}/cases/${caseId}/payments/${paymentIntentId}/evidence/${evidenceId}.${extension}`;
}
