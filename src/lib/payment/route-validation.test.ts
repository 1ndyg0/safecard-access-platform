import { describe, expect, it } from 'vitest';
import { BANK_PAYMENT_ROUTE_IDS } from './config';
import { createPaymentIntentSchema } from '@/lib/validation/schemas';

const base = {
  case_id: '11111111-1111-4111-8111-111111111111',
  campaign_id: '22222222-2222-4222-8222-222222222222',
  payer_type: 'other',
  expected_amount: 1200,
  idempotency_key: 'bank-payment-request-1',
  data_mode: 'live',
};

describe('payment route input validation', () => {
  it('accepts exactly the four owner-approved bank identifiers', () => {
    for (const payment_route of BANK_PAYMENT_ROUTE_IDS) {
      expect(createPaymentIntentSchema.safeParse({ ...base, payment_route }).success).toBe(true);
    }
  });

  it('rejects an unknown bank, an altered identifier and GCash', () => {
    for (const payment_route of ['bank_transfer_other', 'bank-transfer-bpi', 'gcash', '']) {
      expect(createPaymentIntentSchema.safeParse({ ...base, payment_route }).success).toBe(false);
    }
  });
});
