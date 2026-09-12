import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/00021_payment_receipt_pdf_and_declaration_details.sql'),
  'utf8',
);
const memberRoute = readFileSync(
  join(process.cwd(), 'src/app/api/member/payment/mark-paid/route.ts'),
  'utf8',
);

describe('payer declaration database contract', () => {
  it('stores the reported date and amount through the atomic transition', () => {
    expect(migration).toContain('payer_reported_paid_on date');
    expect(migration).toContain('payer_reported_amount numeric(10,2)');
    expect(migration).toContain('p_paid_at date');
    expect(migration).toContain('p_amount_paid numeric');
    expect(migration).toContain('p_amount_paid <> v_intent.expected_amount');
    expect(migration).toContain("drop function if exists public.mark_payment_paid_atomic(uuid,text,text,uuid)");
  });

  it('requires both values from a member before calling the transition', () => {
    expect(memberRoute).toContain('paid_at: z.string().date()');
    expect(memberRoute).toContain('amount_paid: z.coerce.number().positive()');
    expect(memberRoute).toContain('parsed.data.paid_at');
    expect(memberRoute).toContain('parsed.data.amount_paid');
  });

  it('keeps the receipt bucket private while extending it to PDFs', () => {
    expect(migration).toContain("'application/pdf'");
    expect(migration).toContain("'payment-proofs', 'payment-proofs', false, 10485760");
  });
});
