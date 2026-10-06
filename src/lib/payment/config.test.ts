import { describe, expect, it } from 'vitest';
import { BANK_PAYMENT_ROUTE_IDS, MANUAL_PAYMENT_CONFIG, bankLabelForRoute, getApprovedPaymentRoutes, isBankPaymentRoute } from './config';

describe('owner-confirmed bank transfer configuration', () => {
  it('preserves the exact fee, recipient and four approved accounts', () => {
    expect(MANUAL_PAYMENT_CONFIG.amount).toBe(1200);
    expect(MANUAL_PAYMENT_CONFIG.accountName).toBe('Philippine Red Cross');
    expect(MANUAL_PAYMENT_CONFIG.routes).toMatchObject([
      { id: 'bank_transfer_bpi', bank: 'BPI', accountType: 'Savings', currency: 'PHP', accountNumber: '002963007828' },
      { id: 'bank_transfer_bdo', bank: 'BDO', accountType: 'Savings', currency: 'PHP', accountNumber: '004530012185' },
      { id: 'bank_transfer_security_bank', bank: 'Security Bank', accountType: 'Savings', currency: 'PHP', accountNumber: '0132062464003' },
      { id: 'bank_transfer_metrobank', bank: 'Metrobank', accountType: 'Savings', currency: 'PHP', accountNumber: '151-3-15114558-3' },
    ]);
    expect(MANUAL_PAYMENT_CONFIG.routes.every((route) => route.accountName === 'Philippine Red Cross')).toBe(true);
  });

  it('requires campaign bank-transfer approval and rejects unknown identifiers', () => {
    expect(getApprovedPaymentRoutes(new Set())).toEqual([]);
    expect(getApprovedPaymentRoutes(new Set(['bank_transfer'])).map((route) => route.id)).toEqual(BANK_PAYMENT_ROUTE_IDS);
    expect(BANK_PAYMENT_ROUTE_IDS.every(isBankPaymentRoute)).toBe(true);
    expect(isBankPaymentRoute('gcash')).toBe(false);
    expect(isBankPaymentRoute('bank_transfer_other')).toBe(false);
    expect(bankLabelForRoute('bank_transfer_security_bank')).toBe('Security Bank');
  });
});
