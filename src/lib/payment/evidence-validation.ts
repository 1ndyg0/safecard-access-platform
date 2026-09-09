import { createHash } from 'node:crypto';
import sharp from 'sharp';

export const PAYMENT_PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const PAYMENT_PROOF_MAX_PIXELS = 40_000_000;
export const PAYMENT_PROOF_MIN_DIMENSION = 64;
export const PAYMENT_PROOF_MAX_DIMENSION = 12_000;
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
  width: number;
  height: number;
  sanitizedBuffer: Buffer;
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

export async function validatePaymentProof(buffer: Buffer, claimedMimeType: string): Promise<ValidatedPaymentProof> {
  if (!PAYMENT_PROOF_MIME_TYPES.includes(claimedMimeType as PaymentProofMimeType)) throw new PaymentProofValidationError('Only JPEG, PNG, and WebP receipt images are accepted.');
  if (buffer.length === 0 || buffer.length > PAYMENT_PROOF_MAX_BYTES) throw new PaymentProofValidationError('Receipt image must be between 1 byte and 10 MB.');
  const mimeType = claimedMimeType as PaymentProofMimeType;
  const signatureMatches = (mimeType === 'image/png' && isPng(buffer)) || (mimeType === 'image/jpeg' && isJpeg(buffer)) || (mimeType === 'image/webp' && isWebp(buffer));
  if (!signatureMatches) throw new PaymentProofValidationError('The file signature does not match the claimed image type.');
  try {
    const source = sharp(buffer, { failOn: 'warning', limitInputPixels: PAYMENT_PROOF_MAX_PIXELS });
    const metadata = await source.metadata();
    const expectedFormat = mimeType === 'image/jpeg' ? 'jpeg' : mimeType === 'image/png' ? 'png' : 'webp';
    if (metadata.format !== expectedFormat || !metadata.width || !metadata.height) {
      throw new PaymentProofValidationError('The receipt image could not be decoded as the claimed image type.');
    }
    if ((metadata.pages ?? 1) !== 1) {
      throw new PaymentProofValidationError('Animated or multi-page receipt images are not accepted.');
    }
    if (
      metadata.width < PAYMENT_PROOF_MIN_DIMENSION || metadata.height < PAYMENT_PROOF_MIN_DIMENSION ||
      metadata.width > PAYMENT_PROOF_MAX_DIMENSION || metadata.height > PAYMENT_PROOF_MAX_DIMENSION ||
      metadata.width * metadata.height > PAYMENT_PROOF_MAX_PIXELS
    ) {
      throw new PaymentProofValidationError('Receipt image dimensions must be between 64 and 12,000 pixels and no more than 40 megapixels.');
    }

    // Re-encoding validates the complete image and strips EXIF/GPS/profile data.
    // Orientation is applied before metadata is discarded.
    let pipeline = source.rotate();
    if (mimeType === 'image/jpeg') pipeline = pipeline.jpeg({ quality: 90, mozjpeg: true });
    else if (mimeType === 'image/png') pipeline = pipeline.png({ compressionLevel: 9 });
    else pipeline = pipeline.webp({ quality: 90 });
    const sanitizedBuffer = await pipeline.toBuffer();
    if (sanitizedBuffer.length > PAYMENT_PROOF_MAX_BYTES) {
      throw new PaymentProofValidationError('The sanitized receipt image exceeds the 10 MB limit.');
    }

    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
    return {
      mimeType,
      extension,
      sizeBytes: sanitizedBuffer.length,
      sha256: createHash('sha256').update(sanitizedBuffer).digest('hex'),
      width: metadata.width,
      height: metadata.height,
      sanitizedBuffer,
    };
  } catch (error) {
    if (error instanceof PaymentProofValidationError) throw error;
    throw new PaymentProofValidationError('The receipt image is malformed or could not be decoded safely.');
  }
}

export function buildPaymentProofObjectPath(campaignId: string, caseId: string, paymentIntentId: string, evidenceId: string, extension: string) {
  return `campaigns/${campaignId}/cases/${caseId}/payments/${paymentIntentId}/evidence/${evidenceId}.${extension}`;
}
