/**
 * POST /api/referrals/revoke
 *
 * Staff-only: deactivate a referral link.
 * Basic safety control required for MVP.
 */

import { NextRequest } from 'next/server';
import { revokeReferralLink } from '@/lib/referrals';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { success, forbidden, handleApiError } from '@/lib/api/response';
import { z } from 'zod';

const revokeSchema = z.object({
  referral_link_id: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const roleCheck = await requireAnyRole(auth.userId, ['school_admin', 'privacy_admin_owner']);
    if (!roleCheck.allowed) return forbidden(roleCheck.reason);

    const body = await request.json();
    const parsed = revokeSchema.parse(body);

    await revokeReferralLink(parsed.referral_link_id, auth.userId, parsed.reason);

    return success({ revoked: true, message: 'Referral link deactivated' });
  } catch (error) {
    return handleApiError(error, 'Referral revocation');
  }
}
