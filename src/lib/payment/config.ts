/** Owner-confirmed manual Philippine Red Cross bank transfer routes. */
export const BANK_PAYMENT_ROUTE_IDS = [
  'bank_transfer_bpi',
  'bank_transfer_bdo',
  'bank_transfer_security_bank',
  'bank_transfer_metrobank',
] as const;

export type BankPaymentRouteId = (typeof BANK_PAYMENT_ROUTE_IDS)[number];

export const MANUAL_PAYMENT_CONFIG = {
  amount: 1200,
  currency: 'PHP',
  accountName: 'Philippine Red Cross',
  routes: [
    { id: 'bank_transfer_bpi', label: 'BPI', bank: 'BPI', accountType: 'Savings', currency: 'PHP', accountName: 'Philippine Red Cross', accountNumber: '002963007828' },
    { id: 'bank_transfer_bdo', label: 'BDO', bank: 'BDO', accountType: 'Savings', currency: 'PHP', accountName: 'Philippine Red Cross', accountNumber: '004530012185' },
    { id: 'bank_transfer_security_bank', label: 'Security Bank', bank: 'Security Bank', accountType: 'Savings', currency: 'PHP', accountName: 'Philippine Red Cross', accountNumber: '0132062464003' },
    { id: 'bank_transfer_metrobank', label: 'Metrobank', bank: 'Metrobank', accountType: 'Savings', currency: 'PHP', accountName: 'Philippine Red Cross', accountNumber: '151-3-15114558-3' },
  ],
} as const;

export type ManualPaymentRoute = (typeof MANUAL_PAYMENT_CONFIG.routes)[number];

export function isBankPaymentRoute(value: string): value is BankPaymentRouteId {
  return (BANK_PAYMENT_ROUTE_IDS as readonly string[]).includes(value);
}

export function bankLabelForRoute(value: string | null): string {
  return MANUAL_PAYMENT_CONFIG.routes.find((route) => route.id === value)?.label ?? 'Unknown bank route';
}

export function getApprovedPaymentRoutes(approvedTypes: ReadonlySet<string>) {
  return approvedTypes.has('bank_transfer') ? [...MANUAL_PAYMENT_CONFIG.routes] : [];
}
