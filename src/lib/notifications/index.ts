/**
 * Notification Service
 *
 * R1 records in-app notifications in notification_events. External SMS and
 * email delivery are intentionally unavailable until providers are approved.
 *
 * Privacy constraints:
 * - Never include PII in notification text
 * - Use generic language — "your application" not "your Safe Card for [name]"
 * - Respect consent withdrawal (check before sending)
 * - Log all notification attempts in audit trail
 */

import { getSupabaseAdminClient } from '@/lib/db/client';
import { writeAuditEvent } from '@/lib/audit';

export type NotificationChannel = 'in_app';

export interface NotificationPayload {
  recipientCaseId: string;
  channel: NotificationChannel;
  templateKey: string;
  locale: 'tl' | 'en' | 'ceb';
  /** Actor triggering the notification */
  actorId?: string;
  campaignId: string;
}

export interface NotificationResult {
  sent: boolean;
  notificationId: string;
  channel: NotificationChannel;
  reason?: string;
}

/**
 * Bilingual notification templates.
 * Intentionally generic — no PII, no names, no specifics that
 * could identify an individual if the message is seen by others
 * on a shared phone.
 */
const TEMPLATES: Record<string, Record<string, string>> = {
  consent_reminder: {
    tl: 'Mayroon kang pending na consent form. Buksan ang link para magpatuloy.',
    en: 'You have a pending consent form. Open the link to continue.',
    ceb: 'Naa kay pending nga consent form. Ablihi ang link aron magpadayon.',
  },
  application_submitted: {
    tl: 'Natanggap ang iyong application. Hihintayin ang susunod na hakbang.',
    en: 'Your application has been received. Next steps will follow.',
    ceb: 'Nadawat na ang imong application. Ang sunod nga lakang mosunod.',
  },
  payment_reminder: {
    tl: 'May pending na bayad para sa membership. Buksan ang link para sa detalye.',
    en: 'A payment is pending for membership. Open the link for details.',
    ceb: 'Naa kay pending nga bayad para sa membership. Ablihi ang link alang sa detalye.',
  },
  payment_confirmed: {
    tl: 'Nakumpirma ang iyong bayad. Ang application ay ipapadala sa PRC.',
    en: 'Your payment has been confirmed. The application will be forwarded to PRC.',
    ceb: 'Nakumpirma na ang imong bayad. Ang application ipadala sa PRC.',
  },
  membership_active: {
    tl: 'Ang iyong Safe Card membership ay na-activate na!',
    en: 'Your Safe Card membership is now active!',
    ceb: 'Ang imong Safe Card membership kay na-activate na!',
  },
  correction_needed: {
    tl: 'May mga kailangan itama sa iyong application. Buksan ang link.',
    en: 'Your application needs corrections. Open the link to update.',
    ceb: 'Naa kay kinahanglan ayuhon sa imong application. Ablihi ang link.',
  },
  support_update: {
    tl: 'May update sa iyong support request.',
    en: 'There is an update on your support request.',
    ceb: 'Naa bay update sa imong support request.',
  },
};

/**
 * Send a notification. Checks consent status before sending.
 * R1 supports only in-app delivery stored in notification_events.
 */
export async function sendNotification(
  payload: NotificationPayload,
): Promise<NotificationResult> {
  const admin = getSupabaseAdminClient();

  // Check if consent is still active for this case
  const { data: caseData } = await admin
    .from('recipient_cases')
    .select('consent_state, campaign_id')
    .eq('id', payload.recipientCaseId)
    .single();

  if (!caseData) {
    return {
      sent: false,
      notificationId: '',
      channel: payload.channel,
      reason: 'Case not found',
    };
  }
  if (caseData.campaign_id !== payload.campaignId) {
    return {
      sent: false,
      notificationId: '',
      channel: payload.channel,
      reason: 'Case does not belong to this campaign',
    };
  }

  // Don't send if consent is withdrawn or case opted out
  if (caseData.consent_state === 'withdrawn') {
    return {
      sent: false,
      notificationId: '',
      channel: payload.channel,
      reason: 'Consent withdrawn — notification blocked',
    };
  }

  const { data: notificationConsent } = await admin
    .from('consent_records')
    .select('id')
    .eq('case_id', payload.recipientCaseId)
    .eq('consent_type', 'notification_opt_in')
    .eq('state', 'agreed')
    .maybeSingle();
  if (!notificationConsent) {
    return {
      sent: false,
      notificationId: '',
      channel: payload.channel,
      reason: 'Recipient opted out of notifications',
    };
  }

  // Resolve template
  const template = TEMPLATES[payload.templateKey];
  if (!template) {
    return {
      sent: false,
      notificationId: '',
      channel: payload.channel,
      reason: `Unknown template: ${payload.templateKey}`,
    };
  }

  const message = template[payload.locale] ?? template['en'] ?? '';

  // Store notification event
  const { data: notification, error } = await admin
    .from('notification_events')
    .insert({
      case_id: payload.recipientCaseId,
      channel: payload.channel,
      notification_type: payload.templateKey,
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      consent_valid: true,
      content_preview: message,
      metadata: { locale: payload.locale },
    })
    .select('id')
    .single();

  if (error) {
    console.error('[notifications] Failed to store notification:', error.message);
    return {
      sent: false,
      notificationId: '',
      channel: payload.channel,
      reason: `Storage failed: ${error.message}`,
    };
  }

  // Audit the notification
  await writeAuditEvent({
    event_type: 'notification_sent',
    actor_id: payload.actorId ?? null,
    actor_type: payload.actorId ? 'user' : 'system',
    action: `Sent ${payload.channel} notification: ${payload.templateKey}`,
    campaign_id: payload.campaignId,
    target_type: 'recipient_case',
    target_id: payload.recipientCaseId,
    details: {
      channel: payload.channel,
      template_key: payload.templateKey,
      locale: payload.locale,
    },
  });

  return {
    sent: true,
    notificationId: notification.id,
    channel: payload.channel,
  };
}

/**
 * Send a batch of notifications (e.g., reminders for pending cases).
 * Respects consent and opt-out for each recipient.
 */
export async function sendBatchNotifications(
  payloads: NotificationPayload[],
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = [];
  for (const payload of payloads) {
    const result = await sendNotification(payload);
    results.push(result);
  }
  return results;
}

/**
 * Get notification history for a case.
 */
export async function getNotificationHistory(
  caseId: string,
  limit = 20,
): Promise<unknown[]> {
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from('notification_events')
    .select('id, channel, notification_type, status, delivered_at, content_preview, metadata, created_at')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[notifications] Failed to fetch history:', error.message);
    return [];
  }

  return data ?? [];
}
