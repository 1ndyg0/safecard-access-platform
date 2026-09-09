import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { buildPaymentProofObjectPath, PAYMENT_PROOF_MAX_BYTES, validatePaymentProof, PaymentProofValidationError } from './evidence-validation';

async function pngFixture() {
  return sharp({ create: { width: 320, height: 480, channels: 3, background: '#f8f3e8' } }).png().toBuffer();
}

describe('payment proof validation', () => {
  it('fully decodes, sanitizes, and records a valid PNG', async () => {
    const result = await validatePaymentProof(await pngFixture(), 'image/png');
    expect(result.extension).toBe('png');
    expect(result.width).toBe(320);
    expect(result.height).toBe(480);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.sanitizedBuffer.length).toBeGreaterThan(0);
  });

  it('rejects a renamed executable or mismatched claimed MIME type', async () => {
    await expect(validatePaymentProof(Buffer.from('#!/bin/sh\necho unsafe'), 'image/png')).rejects.toThrow(PaymentProofValidationError);
    await expect(validatePaymentProof(await pngFixture(), 'application/pdf')).rejects.toThrow(PaymentProofValidationError);
  });

  it('rejects files over the documented 10 MB limit', async () => {
    const oversized = Buffer.alloc(PAYMENT_PROOF_MAX_BYTES + 1);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(oversized, 0);
    await expect(validatePaymentProof(oversized, 'image/png')).rejects.toThrow(/10 MB/);
  });

  it('rejects a file that only has a plausible image header', async () => {
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0, 0]);
    await expect(validatePaymentProof(fakeJpeg, 'image/jpeg')).rejects.toThrow(/malformed|decoded/);
  });

  it('builds non-enumerable case-scoped paths without names or phone numbers', () => {
    const path = buildPaymentProofObjectPath('campaign-1', 'case-2', 'intent-3', 'evidence-4', 'png');
    expect(path).toBe('campaigns/campaign-1/cases/case-2/payments/intent-3/evidence/evidence-4.png');
    expect(path).not.toMatch(/name|mobile|reference/i);
  });
});
