import { describe, expect, it } from 'vitest';
import { buildPaymentProofObjectPath, PAYMENT_PROOF_MAX_BYTES, validatePaymentProof, PaymentProofValidationError } from './evidence-validation';

function pngFixture() {
  const buffer = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer, 0);
  buffer.writeUInt32BE(1, 16);
  buffer.writeUInt32BE(1, 20);
  return buffer;
}

describe('payment proof validation', () => {
  it('accepts a PNG signature and records checksum and dimensions', () => {
    const result = validatePaymentProof(pngFixture(), 'image/png');
    expect(result.extension).toBe('png');
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects a renamed executable or mismatched claimed MIME type', () => {
    expect(() => validatePaymentProof(Buffer.from('#!/bin/sh\necho unsafe'), 'image/png')).toThrow(PaymentProofValidationError);
    expect(() => validatePaymentProof(pngFixture(), 'application/pdf')).toThrow(PaymentProofValidationError);
  });

  it('rejects files over the documented 10 MB limit', () => {
    const oversized = Buffer.alloc(PAYMENT_PROOF_MAX_BYTES + 1);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(oversized, 0);
    expect(() => validatePaymentProof(oversized, 'image/png')).toThrow(/10 MB/);
  });

  it('builds non-enumerable case-scoped paths without names or phone numbers', () => {
    const path = buildPaymentProofObjectPath('campaign-1', 'case-2', 'intent-3', 'evidence-4', 'png');
    expect(path).toBe('campaigns/campaign-1/cases/case-2/payments/intent-3/evidence/evidence-4.png');
    expect(path).not.toMatch(/name|mobile|reference/i);
  });
});
