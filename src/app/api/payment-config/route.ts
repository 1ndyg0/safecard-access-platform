/**
 * GET /api/payment-config
 *
 * Returns payment channel configuration for the frontend.
 * GCash QR, account number, and bank transfer accounts are
 * stored as environment variables so admin can update them
 * without a code deploy.
 *
 * Cached for 1 hour (CDN + browser).
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-static';
export const revalidate = 3600; // 1 hour

const DEFAULT_BANK_ACCOUNTS = [
  {
    bank: 'BPI',
    type: 'Savings',
    currency: 'PHP',
    accountNumber: '002963007828',
    swiftCode: 'BOPIPHMM',
    branch: 'Chinese Gen. Blumentritt Branch',
  },
  {
    bank: 'BDO',
    type: 'Savings',
    currency: 'PHP',
    accountNumber: '004530012185',
    swiftCode: 'BNORPHM',
    branch: 'South Harbor, Port Area Manila',
  },
  {
    bank: 'Security Bank',
    type: 'Savings',
    currency: 'PHP',
    accountNumber: '0132062464003',
    swiftCode: 'SETCPHMM',
    branch: 'EDSA Mandaluyong Branch',
  },
  {
    bank: 'Metro Bank',
    type: 'Savings',
    currency: 'PHP',
    accountNumber: '151-3-15114558-3',
    swiftCode: 'MBTCPHMM',
    branch: 'Bonifacio Drive, Port Area Manila',
  },
];

export async function GET() {
  let bankAccounts = DEFAULT_BANK_ACCOUNTS;

  if (process.env.PRC_BANK_ACCOUNTS_JSON) {
    try {
      bankAccounts = JSON.parse(process.env.PRC_BANK_ACCOUNTS_JSON);
    } catch {
      // Use defaults if JSON is malformed
    }
  }

  const config = {
    amount: 1200,
    accountName: 'Philippine Red Cross',
    channels: {
      gcash: {
        qrImageUrl: process.env.GCASH_QR_IMAGE_URL || '',
        accountNumber: process.env.GCASH_ACCOUNT_NUMBER || '',
      },
      bankTransfer: {
        accounts: bankAccounts,
      },
    },
  };

  return NextResponse.json(config, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
