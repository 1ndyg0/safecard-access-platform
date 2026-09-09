import { describe, expect, it } from 'vitest';
import { MANUAL_PAYMENT_CONFIG, getApprovedPaymentRoutes, getPaymentRoutes } from './config';

describe('manual payment configuration', () => {
  it('keeps the approved annual fee and explanatory monthly equivalent exact', () => {
    expect(MANUAL_PAYMENT_CONFIG.amount).toBe(1200);
    expect(MANUAL_PAYMENT_CONFIG.monthlyEquivalent).toBe(100);
    expect(MANUAL_PAYMENT_CONFIG.currency).toBe('PHP');
    expect(MANUAL_PAYMENT_CONFIG.accountName).toBe('PHILIPPINE RED CROSS');
  });

  it('keeps every supplied bank account and SWIFT value centralized', () => {
    expect(MANUAL_PAYMENT_CONFIG.routes.filter((route): route is Extract<typeof route, { bank: string }> => 'bank' in route)).toMatchObject([
      { bank: 'BPI', accountNumber: '002963007828', swiftCode: 'BOPIPHMM', branch: 'Chinese Gen., Blumentritt Branch' },
      { bank: 'BDO', accountNumber: '004530012185', swiftCode: 'BNORPHM', branch: 'South Harbor, Port Area Manila' },
      { bank: 'Security Bank', accountNumber: '0132062464003', swiftCode: 'SETCPHMM', branch: 'EDSA Mandaluyong Branch' },
      { bank: 'Metrobank', accountNumber: '151-3-15114558-3', swiftCode: 'MBTCPHMM', branch: 'Bonifacio Drive, Port Area Manila' },
    ]);
  });

  it('only attaches the private signed QR URL to the GCash route', () => {
    const routes = getPaymentRoutes('https://signed.example/qr');
    expect(routes.find((route) => route.id === 'gcash')?.qrImageUrl).toBe('https://signed.example/qr');
    expect(routes.filter((route) => route.id !== 'gcash').every((route) => !('qrImageUrl' in route))).toBe(true);
  });

  it('shows only route types approved for the selected campaign', () => {
    expect(getApprovedPaymentRoutes(new Set(['gcash']))).toHaveLength(1);
    expect(getApprovedPaymentRoutes(new Set(['gcash']))[0]?.id).toBe('gcash');
    expect(getApprovedPaymentRoutes(new Set(['bank_transfer'])).map((route) => route.id)).toEqual([
      'bpi',
      'bdo',
      'security-bank',
      'metrobank',
    ]);
  });
});
