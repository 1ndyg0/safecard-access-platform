/**
 * POST /api/notifications/send
 *
 * Staff-initiated notification to a specific case or batch.
 * Validates consent and opt-out before sending.
 */

import { NextRequest } from 'next/server';
import { sendNotification, sendBatchNotifications } from '@/lib/notifications';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { success, forbidden, handleApiError } from '@/lib/api/response';
import { z } from 'zod';

const sendNotificationSchema = z.object({
  case_ids: z.array(z.string().uuid()).min(1).max(100),
  channel: z.literal('in_app'),
  template_key: z.string().min(1).max(100),
  locale: z.enum(['tl', 'en', 'ceb']).default('tl'),
  campaign_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const body = await request.json();
    const parsed = sendNotificationSchema.parse(body);
    const roleCheck = await requireAnyRole(auth.userId, [
      'school_admin', 'support_agent', 'privacy_admin_owner',
    ], parsed.campaign_id);
    if (!roleCheck.allowed) return forbidden(roleCheck.reason);

    if (parsed.case_ids.length === 1) {
      const result = await sendNotification({
        recipientCaseId: parsed.case_ids[0],
        channel: parsed.channel,
        templateKey: parsed.template_key,
        locale: parsed.locale,
        campaignId: parsed.campaign_id,
        actorId: auth.userId,
      });

      return success({ results: [result] });
    }

    const payloads = parsed.case_ids.map((caseId) => ({
      recipientCaseId: caseId,
      channel: parsed.channel,
      templateKey: parsed.template_key,
      locale: parsed.locale as 'tl' | 'en' | 'ceb',
      campaignId: parsed.campaign_id,
      actorId: auth.userId,
    }));

    const results = await sendBatchNotifications(payloads);

    const sent = results.filter((r) => r.sent).length;
    const blocked = results.filter((r) => !r.sent).length;

    return success({
      results,
      summary: { sent, blocked, total: results.length },
    });
  } catch (error) {
    return handleApiError(error, 'Notification send');
  }
}
