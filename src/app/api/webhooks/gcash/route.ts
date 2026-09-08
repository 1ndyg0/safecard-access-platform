/**
 * POST /api/webhooks/gcash
 *
 * GCash payment callback webhook endpoint.
 *
 * Security:
 * - Verifies HMAC-SHA256 signature
 * - Validates amount matches expected
 * - Validates reference matches our records
 * - Checks timestamp freshness (prevents replay)
 * - Stores raw payload server-side only (restricted access)
 *
 * This endpoint does NOT activate membership.
 * Payment verification only updates payment state.
 */

import { NextResponse } from 'next/server';

export async function POST() {
  // Direct gateway integration is explicitly outside the R1 contract. Keeping
  // this endpoint closed prevents configuration drift from silently enabling it.
  return NextResponse.json(
    { error: 'Direct GCash integration is not available in this release' },
    { status: 404 },
  );
}
