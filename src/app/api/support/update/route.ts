/**
 * POST /api/support/update
 *
 * Update a support case state (validate transition via state machine).
 * Staff-only: school admin, support, privacy admin.
 *
 * Special handling for consent_withdrawal — triggers consent withdrawal
 * and stops all processing.
 */

import { NextRequest } from 'next/server';
import { updateSupportCaseState, processConsentWithdrawalRequest } from '@/lib/support';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { success, forbidden, handleApiError } from '@/lib/api/response';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/client';

const updateSupportSchema = z.object({
  support_case_id: z.string().uuid(),
  new_state: z.enum([
    'open', 'waiting_on_recipient', 'waiting_on_school',
    'waiting_on_prc', 'resolved', 'closed_no_response',
  ]).optional(),
  resolution_notes: z.string().max(5000).optional(),
  process_withdrawal: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const body = await request.json();
    const parsed = updateSupportSchema.parse(body);
    const { data: supportCase } = await getSupabaseAdminClient()
      .from('support_cases')
      .select('campaign_id')
      .eq('id', parsed.support_case_id)
      .maybeSingle();
    if (!supportCase) throw new Error('Support case not found');
    const roleCheck = await requireAnyRole(auth.userId, [
      'school_admin', 'support_agent', 'privacy_admin_owner',
    ], supportCase.campaign_id ?? undefined);
    if (!roleCheck.allowed) return forbidden(roleCheck.reason);

    // If this is a consent withdrawal request being processed
    if (parsed.process_withdrawal) {
      await processConsentWithdrawalRequest(parsed.support_case_id, auth.userId);

      return success({
        updated: true,
        message: 'Consent withdrawal processed — all consent records withdrawn, notifications stopped',
      });
    }

    if (!parsed.new_state) throw new Error('new_state is required');
    await updateSupportCaseState(
      parsed.support_case_id,
      parsed.new_state,
      auth.userId,
      parsed.resolution_notes,
    );

    return success({
      updated: true,
      newState: parsed.new_state,
    });
  } catch (error) {
    return handleApiError(error, 'Support case update');
  }
}
