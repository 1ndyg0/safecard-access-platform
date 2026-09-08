/**
 * Controlled-pilot payment configuration.
 *
 * Provenance: values transcribed from the user-supplied payment reference in
 * the implementation brief (2026-09-08). Owner/PRC verification is still
 * required before LAUNCH_GATES_COMPLETE and ENABLE_OFFICIAL_PAYMENT_HANDOFF
 * may be enabled. Keep this module server-only and do not duplicate values in
 * client components.
 */

export const MANUAL_PAYMENT_CONFIG = {
  amount: 1200,
  currency: 'PHP',
  monthlyEquivalent: 100,
  accountName: 'PHILIPPINE RED CROSS',
  qrObjectPath: 'official/gcash-qr.webp',
  routes: [
    {
      id: 'gcash',
      label: 'GCash QR',
      instructions: 'Open GCash, scan the official QR, complete the transfer outside SafeCard, then return with your receipt or transaction reference.',
      accountName: 'PHILIPPINE RED CROSS',
      qrObjectPath: 'official/gcash-qr.webp',
    },
    {
      id: 'bpi',
      label: 'BPI bank transfer',
      instructions: 'Transfer PHP 1,200 to the official PRC account, save the receipt, then return to upload proof of payment.',
      accountName: 'PHILIPPINE RED CROSS',
      bank: 'BPI',
      accountType: 'Savings',
      currency: 'PHP',
      accountNumber: '002963007828',
      swiftCode: 'BOPIPHMM',
      branch: 'Chinese Gen., Blumentritt Branch',
    },
    {
      id: 'bdo',
      label: 'BDO bank transfer',
      instructions: 'Transfer PHP 1,200 to the official PRC account, save the receipt, then return to upload proof of payment.',
      accountName: 'PHILIPPINE RED CROSS',
      bank: 'BDO',
      accountType: 'Savings',
      currency: 'PHP',
      accountNumber: '004530012185',
      swiftCode: 'BNORPHM',
      branch: 'South Harbor, Port Area Manila',
    },
    {
      id: 'security-bank',
      label: 'Security Bank transfer',
      instructions: 'Transfer PHP 1,200 to the official PRC account, save the receipt, then return to upload proof of payment.',
      accountName: 'PHILIPPINE RED CROSS',
      bank: 'Security Bank',
      accountType: 'Savings',
      currency: 'PHP',
      accountNumber: '0132062464003',
      swiftCode: 'SETCPHMM',
      branch: 'EDSA Mandaluyong Branch',
    },
    {
      id: 'metrobank',
      label: 'Metrobank transfer',
      instructions: 'Transfer PHP 1,200 to the official PRC account, save the receipt, then return to upload proof of payment.',
      accountName: 'PHILIPPINE RED CROSS',
      bank: 'Metrobank',
      accountType: 'Savings',
      currency: 'PHP',
      accountNumber: '151-3-15114558-3',
      swiftCode: 'MBTCPHMM',
      branch: 'Bonifacio Drive, Port Area Manila',
    },
  ],
} as const;

export type ManualPaymentRoute = (typeof MANUAL_PAYMENT_CONFIG.routes)[number];

export function getPaymentRoutes(qrImageUrl?: string) {
  return MANUAL_PAYMENT_CONFIG.routes.map((route) => {
    if (route.id !== 'gcash') return route;
    return { ...route, qrImageUrl: qrImageUrl ?? null };
  });
}
