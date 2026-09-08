/**
 * Audit logging service
 *
 * Immutable audit trail for all sensitive operations.
 * Records: role changes, content approvals, application submit,
 * consent withdrawal, export creation, PRC acknowledgment,
 * membership status changes, staff access, and security events.
 */

import { getSupabaseAdminClient } from '@/lib/db/client';
import type { AuditEventType } from '@/types/database';
import { createHash } from 'node:crypto';

export interface AuditEntry {
  event_type: AuditEventType;
  actor_id: string | null;
  actor_type: 'user' | 'system' | 'anonymous';
  action: string;
  target_type?: string;
  target_id?: string;
  case_id?: string;
  campaign_id?: string;
  details?: Record<string, unknown>;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  actor_ip?: string; // Raw IP — will be hashed before storage
}

/**
 * Write an audit event. Never throws — logs errors to stderr instead.
 * Audit writes must not block the primary operation.
 */
export async function writeAuditEvent(entry: AuditEntry): Promise<string | null> {
  try {
    const admin = getSupabaseAdminClient();

    const { data, error } = await admin
      .from('audit_events')
      .insert({
        event_type: entry.event_type,
        actor_id: entry.actor_id,
        actor_type: entry.actor_type,
        actor_ip_hash: entry.actor_ip ? hashIp(entry.actor_ip) : null,
        target_type: entry.target_type ?? null,
        target_id: entry.target_id ?? null,
        case_id: entry.case_id ?? null,
        campaign_id: entry.campaign_id ?? null,
        action: entry.action,
        details: entry.details ?? {},
        severity: entry.severity ?? 'info',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[AUDIT] Failed to write audit event:', error.message);
      return null;
    }

    return data.id;
  } catch (err) {
    console.error('[AUDIT] Unexpected error writing audit event:', err instanceof Error ? err.name : 'UnknownError');
    return null;
  }
}

/**
 * Write multiple audit events in a batch.
 */
export async function writeAuditBatch(entries: AuditEntry[]): Promise<void> {
  try {
    const admin = getSupabaseAdminClient();

    const rows = entries.map((entry) => ({
      event_type: entry.event_type,
      actor_id: entry.actor_id,
      actor_type: entry.actor_type,
      actor_ip_hash: entry.actor_ip ? hashIp(entry.actor_ip) : null,
      target_type: entry.target_type ?? null,
      target_id: entry.target_id ?? null,
      case_id: entry.case_id ?? null,
      campaign_id: entry.campaign_id ?? null,
      action: entry.action,
      details: entry.details ?? {},
      severity: entry.severity ?? 'info',
    }));

    const { error } = await admin.from('audit_events').insert(rows);

    if (error) {
      console.error('[AUDIT] Failed to write audit batch:', error.message);
    }
  } catch (err) {
    console.error('[AUDIT] Unexpected error writing audit batch:', err instanceof Error ? err.name : 'UnknownError');
  }
}

/**
 * Hash an IP address before storage.
 * We never store raw IPs — only a salted SHA-256 hash.
 */
export function hashSensitiveIdentifier(ip: string): string {
  const salt = process.env.AUDIT_HASH_SALT;
  if ((!salt || salt.length < 32 || salt.startsWith('replace-with-')) && process.env.NODE_ENV === 'production') {
    throw new Error('AUDIT_HASH_SALT must be at least 32 characters in production');
  }
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

const hashIp = hashSensitiveIdentifier;
