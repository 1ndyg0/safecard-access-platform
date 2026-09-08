/**
 * Content version management
 *
 * Backend responsibility — not just frontend copy.
 * Every approved content item tracks: type, locale, version,
 * approval status, approver, source, expiry, affected surfaces.
 *
 * Key rules:
 * - Content changes that are material may invalidate existing consent
 * - The backend records which content versions the recipient saw at consent time
 * - Unresolved contradictions must be flagged before production use
 * - PRC liaison (Elena) approves; school admin (Aira) publishes
 */

import { getSupabaseAdminClient } from '@/lib/db/client';
import { writeAuditEvent } from '@/lib/audit';
import type { ContentType } from '@/types/database';

// ============================================================
// Get published content by type and locale
// ============================================================

export interface PublishedContent {
  id: string;
  content_type: ContentType;
  locale: string;
  version: number;
  title: string;
  body: string;
  summary: string | null;
  source: string | null;
  source_last_updated: string | null;
  review_date: string | null;
  approved_at: string | null;
}

export async function getPublishedContent(
  contentType: ContentType,
  locale: 'en' | 'tl' | 'ceb' = 'tl',
): Promise<PublishedContent | null> {
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from('content_versions')
    .select(
      'id, content_type, locale, version, title, body, summary, source, source_last_updated, review_date, approved_at'
    )
    .eq('content_type', contentType)
    .eq('locale', locale)
    .eq('is_published', true)
    .eq('approval_status', 'approved')
    .or('expiry_date.is.null,expiry_date.gt.' + new Date().toISOString().split('T')[0])
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as PublishedContent;
}

/**
 * Get all published content for a given locale (for landing page).
 */
export async function getAllPublishedContent(
  locale: 'en' | 'tl' | 'ceb' = 'tl',
): Promise<PublishedContent[]> {
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from('content_versions')
    .select(
      'id, content_type, locale, version, title, body, summary, source, source_last_updated, review_date, approved_at'
    )
    .eq('locale', locale)
    .eq('is_published', true)
    .eq('approval_status', 'approved')
    .or('expiry_date.is.null,expiry_date.gt.' + new Date().toISOString().split('T')[0])
    .order('content_type', { ascending: true })
    .order('version', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch published content: ${error.message}`);
  }

  return (data ?? []) as PublishedContent[];
}

// ============================================================
// Create a new content version
// ============================================================

export interface CreateContentInput {
  content_type: ContentType;
  locale: 'en' | 'tl' | 'ceb';
  title: string;
  body: string;
  summary?: string;
  source?: string;
  source_last_updated?: string;
  review_date?: string;
  expiry_date?: string;
  affected_surfaces?: string[];
  supersedes_id?: string;
  change_summary?: string;
  is_material_change?: boolean;
  created_by: string;
}

export async function createContentVersion(
  input: CreateContentInput,
): Promise<{
  id: string;
  contentType: ContentType;
  locale: 'en' | 'tl' | 'ceb';
  version: number;
  isMaterialChange: boolean;
}> {
  const admin = getSupabaseAdminClient();

  // Determine next version number
  const { data: latest } = await admin
    .from('content_versions')
    .select('version')
    .eq('content_type', input.content_type)
    .eq('locale', input.locale)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;

  const { data, error } = await admin
    .from('content_versions')
    .insert({
      content_type: input.content_type,
      locale: input.locale,
      version: nextVersion,
      created_by: input.created_by,
      title: input.title,
      body: input.body,
      summary: input.summary ?? null,
      approval_status: 'draft',
      source: input.source ?? null,
      source_last_updated: input.source_last_updated ?? null,
      review_date: input.review_date ?? null,
      expiry_date: input.expiry_date ?? null,
      affected_surfaces: input.affected_surfaces ?? [],
      supersedes_id: input.supersedes_id ?? null,
      change_summary: input.change_summary ?? null,
      is_material_change: input.is_material_change ?? false,
    })
    .select('id, version')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create content version: ${error?.message}`);
  }

  return {
    id: data.id,
    contentType: input.content_type,
    locale: input.locale,
    version: data.version,
    isMaterialChange: input.is_material_change ?? false,
  };
}

// ============================================================
// Approve content (PRC liaison action)
// ============================================================

export async function approveContent(
  contentVersionId: string,
  approvedBy: string,
): Promise<void> {
  const admin = getSupabaseAdminClient();

  const { data: candidate, error: candidateError } = await admin
    .from('content_versions')
    .select('id, source, source_last_updated, review_date, expiry_date')
    .eq('id', contentVersionId)
    .in('approval_status', ['draft', 'pending_review'])
    .maybeSingle();
  if (candidateError || !candidate) {
    throw new Error('Content version is not approvable');
  }
  if (!candidate.source || !candidate.source_last_updated || !candidate.review_date) {
    throw new Error('PRC approval requires source, source_last_updated, and review_date');
  }
  if (candidate.expiry_date && candidate.expiry_date <= new Date().toISOString().slice(0, 10)) {
    throw new Error('Expired content cannot be approved');
  }

  const { data, error } = await admin
    .from('content_versions')
    .update({
      approval_status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq('id', contentVersionId)
    .in('approval_status', ['draft', 'pending_review'])
    .select('id')
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to approve content: ${error?.message ?? 'version is not approvable'}`);
  }

  await writeAuditEvent({
    event_type: 'content_approval',
    actor_id: approvedBy,
    actor_type: 'user',
    action: `Approved content version ${contentVersionId}`,
    target_type: 'content_version',
    target_id: contentVersionId,
  });
}

// ============================================================
// Publish content (school admin action, after PRC approval)
// ============================================================

export async function publishContent(
  contentVersionId: string,
  publishedBy: string,
): Promise<{
  contentType: ContentType;
  locale: string;
  version: number;
  consentExpiredCount: number;
}> {
  const admin = getSupabaseAdminClient();

  // Verify it's approved first
  const { data: content } = await admin
    .from('content_versions')
    .select('content_type, locale, version, approval_status, is_material_change')
    .eq('id', contentVersionId)
    .single();

  if (!content || content.approval_status !== 'approved') {
    throw new Error('Content must be approved by PRC before publishing');
  }

  // Unpublish the previous version of this type+locale
  const { error: unpublishError } = await admin
    .from('content_versions')
    .update({ is_published: false, unpublished_at: new Date().toISOString() })
    .eq('content_type', content.content_type)
    .eq('locale', content.locale)
    .eq('is_published', true);
  if (unpublishError) {
    throw new Error(`Failed to unpublish current content: ${unpublishError.message}`);
  }

  // Publish the new version
  const { error } = await admin
    .from('content_versions')
    .update({
      is_published: true,
      published_at: new Date().toISOString(),
      published_by: publishedBy,
    })
    .eq('id', contentVersionId);

  if (error) {
    throw new Error(`Failed to publish content: ${error.message}`);
  }

  // If this is a material change, expire existing consent tied to old version
  const consentExpiredCount = content.is_material_change
    ? await expireConsentForContentChange(content.content_type, content.locale, contentVersionId)
    : 0;

  await writeAuditEvent({
    event_type: 'content_publish',
    actor_id: publishedBy,
    actor_type: 'user',
    action: `Published content version ${contentVersionId} (${content.content_type}/${content.locale})`,
    target_type: 'content_version',
    target_id: contentVersionId,
    details: {
      content_type: content.content_type,
      locale: content.locale,
      is_material_change: content.is_material_change,
      consent_expired_count: consentExpiredCount,
    },
  });

  return {
    contentType: content.content_type as ContentType,
    locale: content.locale,
    version: content.version,
    consentExpiredCount,
  };
}

// ============================================================
// Expire consent when content changes materially
// ============================================================

export async function expireConsentForContentChange(
  contentType: string,
  locale: string,
  newVersionId: string,
): Promise<number> {
  const admin = getSupabaseAdminClient();

  if (contentType !== 'consent_text' && contentType !== 'privacy_notice') {
    return 0;
  }

  // Find active consents tied to old versions of this content type
  // This is a simplified approach — in production, you'd check
  // which content version IDs were referenced in consent records
  let query = admin
    .from('consent_records')
    .select('id, case_id')
    .eq('state', 'agreed')
    .eq('locale', locale);

  query = contentType === 'consent_text'
    ? query.neq('consent_content_version_id', newVersionId)
    : query.neq('privacy_notice_version_id', newVersionId);

  const { data: affectedConsents, error } = await query;
  if (error) throw new Error(`Failed to identify affected consent: ${error.message}`);

  if (!affectedConsents?.length) return 0;

  // Mark affected consents as expired
  const ids = affectedConsents.map((c) => c.id);
  await admin
    .from('consent_records')
    .update({
      state: 'expired_due_to_content_change',
      expired_at: new Date().toISOString(),
      expired_reason: `Material content change in ${contentType}/${locale}`,
    })
    .in('id', ids);

  // Update the corresponding case consent_state
  const caseIds = [...new Set(affectedConsents.map((c) => c.case_id))];
  await admin
    .from('recipient_cases')
    .update({ consent_state: 'expired_due_to_content_change' })
    .in('id', caseIds);

  return affectedConsents.length;
}

// ============================================================
// Check for stale/expiring content (cron job)
// ============================================================

export async function checkContentExpiry(): Promise<{
  expired: number;
  expiringSoon: number;
}> {
  const admin = getSupabaseAdminClient();
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // Expire content past its expiry date
  const { data: expired } = await admin
    .from('content_versions')
    .update({ approval_status: 'expired', is_published: false })
    .eq('is_published', true)
    .lt('expiry_date', today)
    .select('id');

  // Find content expiring within 7 days (for alerts)
  const { data: expiringSoon } = await admin
    .from('content_versions')
    .select('id')
    .eq('is_published', true)
    .gte('expiry_date', today)
    .lte('expiry_date', sevenDaysFromNow);

  return {
    expired: expired?.length ?? 0,
    expiringSoon: expiringSoon?.length ?? 0,
  };
}
