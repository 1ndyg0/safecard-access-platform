/**
 * POST /api/export/acknowledge
 *
 * PRC liaison: acknowledge, accept, reject, or request correction
 * for individual records in an export batch.
 *
 * When PRC accepts with a membership ID → membership activates.
 * When PRC rejects → membership is declined.
 * When PRC requests correction → case enters correction_needed state.
 *
 * Persona: Elena (PRC liaison) processes each record.
 */

import { NextRequest } from 'next/server';
import { acknowledgePrcItem } from '@/lib/export';
import { acknowledgePrcItemSchema } from '@/lib/validation/schemas';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { success, forbidden, handleApiError } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const body = await request.json();
    const parsed = acknowledgePrcItemSchema.parse(body);

    const admin = getSupabaseAdminClient();
    const { data: item, error } = await admin
      .from('prc_export_items')
      .select('id,prc_export_batches!inner(campaign_id)')
      .eq('id', parsed.export_item_id)
      .maybeSingle();
    if (error || !item) return forbidden('Export item is not available in your campaign scope');
    const batch = Array.isArray(item.prc_export_batches)
      ? item.prc_export_batches[0]
      : item.prc_export_batches;
    const roleCheck = await requireRole(auth.userId, 'prc_liaison', batch.campaign_id);
    if (!roleCheck.allowed) {
      return forbidden('Only this campaign’s PRC liaison can acknowledge export items');
    }

    await acknowledgePrcItem({
      exportItemId: parsed.export_item_id,
      prcStatus: parsed.prc_status,
      prcNotes: parsed.prc_notes,
      correctionReason: parsed.correction_reason,
      correctionFields: parsed.correction_fields as Record<string, unknown>,
      prcMembershipId: parsed.prc_membership_id,
      prcEffectiveDate: parsed.prc_effective_date,
      prcExpiryDate: parsed.prc_expiry_date,
      actorId: auth.userId,
    });

    const messages: Record<string, string> = {
      acknowledged: 'Record acknowledged by PRC',
      correction_requested: 'Correction requested — record will be flagged for the applicant',
      accepted: 'Record accepted — membership activated',
      rejected: 'Record rejected — membership declined',
    };

    return success({
      processed: true,
      message: messages[parsed.prc_status],
    });
  } catch (error) {
    return handleApiError(error, 'PRC acknowledgment');
  }
}
