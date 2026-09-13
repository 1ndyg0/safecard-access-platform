import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { buildPaymentProofObjectPath, PAYMENT_PROOF_MAX_BYTES, validatePaymentProof, PaymentProofValidationError } from './evidence-validation';

function pngFixture() {
  const buffer = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer, 0);
  buffer.writeUInt32BE(1, 16);
  buffer.writeUInt32BE(1, 20);
  return buffer;
}

describe('payment proof validation', () => {
  it.each([
    ['image/png', pngFixture()],
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff])],
    ['image/webp', Buffer.from('RIFF0000WEBP')],
  ])('rejects a signature-only invalid %s image', async (mime, bytes) => {
    await expect(Promise.resolve().then(() => validatePaymentProof(bytes, mime)))
      .rejects.toBeInstanceOf(PaymentProofValidationError);
  });
  it.each(['png', 'jpeg', 'webp'] as const)('decodes valid %s images and records the stored checksum and dimensions', async (format) => {
    const bytes = await sharp({ create: { width: 2, height: 3, channels: 3, background: '#ffffff' } }).toFormat(format).toBuffer();
    const result = await validatePaymentProof(bytes, `image/${format}`);
    expect(result.extension).toBe(format === 'jpeg' ? 'jpg' : format);
    expect(result.width).toBe(2);
    expect(result.height).toBe(3);
    expect(result.sha256).toBe(createHash('sha256').update(result.buffer).digest('hex'));
    expect(result.sizeBytes).toBe(result.buffer.length);
  });

  it('rejects a renamed executable or mismatched claimed MIME type', async () => {
    await expect(validatePaymentProof(Buffer.from('#!/bin/sh\necho unsafe'), 'image/png')).rejects.toThrow(PaymentProofValidationError);
    await expect(validatePaymentProof(pngFixture(), 'application/pdf')).rejects.toThrow(PaymentProofValidationError);
  });

  it('rejects files over the documented 10 MB limit', async () => {
    const oversized = Buffer.alloc(PAYMENT_PROOF_MAX_BYTES + 1);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(oversized, 0);
    await expect(validatePaymentProof(oversized, 'image/png')).rejects.toThrow(/10 MB/);
  });

  it('strips embedded metadata and appended payloads before storage', async () => {
    const image = await sharp({ create: { width: 2, height: 3, channels: 3, background: '#ffffff' } })
      .withExif({ IFD0: { Artist: 'SYNTHETIC PRIVATE METADATA' } }).jpeg().toBuffer();
    const result = await validatePaymentProof(Buffer.concat([image, Buffer.from('<script>unsafe()</script>')]), 'image/jpeg');
    expect((await sharp(result.buffer).metadata()).exif).toBeUndefined();
    expect(result.buffer.includes(Buffer.from('<script>'))).toBe(false);
  });

  it('builds non-enumerable case-scoped paths without names or phone numbers', () => {
    const path = buildPaymentProofObjectPath('campaign-1', 'case-2', 'intent-3', 'evidence-4', 'png');
    expect(path).toBe('campaigns/campaign-1/cases/case-2/payments/intent-3/evidence/evidence-4.png');
    expect(path).not.toMatch(/name|mobile|reference/i);
  });
});
