/**
 * POST /api/payment/verify
 *
 * Staff-only: manually verify a payment after reconciliation.
 * Used when GCash callback didn't fire or for manual payment routes.
 *
 * Persona: Aira (school admin) reconciles payment evidence.
 */

import { NextRequest } from 'next/server';
import { verifyPayment } from '@/lib/payment';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { success, forbidden, handleApiError } from '@/lib/api/response';
import { z } from 'zod';

const verifySchema = z.object({
  payment_intent_id: z.string().uuid(),
  verification_source: z.enum(['manual_prc_reconciliation', 'prc_confirmation']),
  evidence: z.object({
    official_reference: z.string().min(1).max(100).optional(),
  }).strict().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const roleCheck = await requireAnyRole(auth.userId, [
      'finance_export', 'school_admin', 'prc_liaison',
    ]);
    if (!roleCheck.allowed) return forbidden(roleCheck.reason);

    const body = await request.json();
    const parsed = verifySchema.parse(body);

    await verifyPayment(
      parsed.payment_intent_id,
      auth.userId,
      parsed.verification_source,
      parsed.evidence,
    );

    return success({
      verified: true,
      message: 'Payment verified. Membership remains inactive until PRC confirms.',
    });
  } catch (error) {
    return handleApiError(error, 'Payment verification');
  }
}
