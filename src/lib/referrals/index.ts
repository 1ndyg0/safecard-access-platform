/**
 * Referral link management
 *
 * Handles: creation, validation, attribution, activation,
 * expiration, revocation, and safe fallback for invalid links.
 *
 * Journey phases: 1 (Sponsor Preparation) and 2 (Explain and Invite)
 *
 * Key rules:
 * - Attribution is optional (nullable referral_link_id)
 * - Invalid/expired links load the general landing page, no attribution guess
 * - Referral code alone is never a login credential
 * - No public directory of sponsors, recipients, or referrals
 */

import { getSupabaseAdminClient } from '@/lib/db/client';
import { writeAuditEvent } from '@/lib/audit';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Slug generation
// ============================================================

/**
 * Generate a unique, URL-safe referral slug.
 * Format: 6-character alphanumeric, case-insensitive.
 */
function generateSlug(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // No ambiguous chars (0/O, 1/l/I)
  const bytes = Buffer.from(uuidv4().replace(/-/g, ''), 'hex');
  let slug = '';
  for (let i = 0; i < 6; i++) {
    slug += chars[bytes[i] % chars.length];
  }
  return slug;
}

// ============================================================
// Create a referral link
// ============================================================

export interface CreateReferralInput {
  sponsorId: string;
  campaignId: string;
  expiresAt?: string;
  idempotencyKey: string;
  actorId: string;
}

export interface ReferralLinkResult {
  id: string;
  slug: string;
  status: 'created' | 'exists';
}

export async function createReferralLink(
  input: CreateReferralInput,
): Promise<ReferralLinkResult> {
  const admin = getSupabaseAdminClient();

  const { data: sponsor } = await admin
    .from('sponsors')
    .select('id')
    .eq('id', input.sponsorId)
    .eq('campaign_id', input.campaignId)
    .eq('auth_user_id', input.actorId)
    .eq('is_active', true)
    .maybeSingle();
  if (!sponsor) throw new Error('Permission denied: sponsor does not belong to this campaign');

  // Idempotency check
  const { data: existing } = await admin
    .from('referral_links')
    .select('id, slug')
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle();

  if (existing) {
    return { id: existing.id, slug: existing.slug, status: 'exists' };
  }

  // Generate a unique slug (retry if collision)
  let slug: string;
  let attempts = 0;
  do {
    slug = generateSlug();
    const { data: collision } = await admin
      .from('referral_links')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!collision) break;
    attempts++;
  } while (attempts < 5);

  if (attempts >= 5) {
    throw new Error('Failed to generate unique referral slug after 5 attempts');
  }

  const id = uuidv4();

  const { error } = await admin.from('referral_links').insert({
    id,
    sponsor_id: input.sponsorId,
    campaign_id: input.campaignId,
    slug,
    is_active: true,
    activated_at: new Date().toISOString(),
    expires_at: input.expiresAt ?? null,
    idempotency_key: input.idempotencyKey,
  });

  if (error) {
    throw new Error(`Failed to create referral link: ${error.message}`);
  }

  await writeAuditEvent({
    event_type: 'referral_created',
    actor_id: input.actorId,
    actor_type: 'user',
    action: `Created referral link ${slug} for sponsor ${input.sponsorId}`,
    target_type: 'referral_link',
    target_id: id,
    campaign_id: input.campaignId,
    details: { slug, sponsor_id: input.sponsorId },
  });

  return { id, slug, status: 'created' };
}

// ============================================================
// Validate a referral slug (public, for landing page)
// ============================================================

export interface ValidateSlugResult {
  valid: boolean;
  referralLinkId?: string;
  campaignId?: string;
  sponsorDisplayName?: string;
  reason?: string;
}

export async function validateReferralSlug(slug: string): Promise<ValidateSlugResult> {
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from('referral_links')
    .select(`
      id,
      campaign_id,
      is_active,
      expires_at,
      sponsors!inner (display_name)
    `)
    .eq('slug', slug.toLowerCase())
    .maybeSingle();

  if (error || !data) {
    // Safe fallback: invalid link loads general landing page
    return { valid: false, reason: 'invalid_slug' };
  }

  if (!data.is_active) {
    return { valid: false, reason: 'deactivated' };
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, reason: 'expired' };
  }

  // Increment atomically. Analytics failure must not make a valid invitation
  // unusable, but it is awaited so serverless execution cannot drop the write.
  await admin.rpc('increment_referral_visits', { p_referral_link_id: data.id });

  const sponsorRelation = Array.isArray(data.sponsors) ? data.sponsors[0] : data.sponsors;
  return {
    valid: true,
    referralLinkId: data.id,
    campaignId: data.campaign_id,
    sponsorDisplayName: sponsorRelation?.display_name,
  };
}

// ============================================================
// Revoke a referral link
// ============================================================

export async function revokeReferralLink(
  linkId: string,
  revokedBy: string,
  reason: string,
): Promise<void> {
  const admin = getSupabaseAdminClient();

  const { error } = await admin
    .from('referral_links')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_by: revokedBy,
      revocation_reason: reason,
    })
    .eq('id', linkId);

  if (error) {
    throw new Error(`Failed to revoke referral link: ${error.message}`);
  }

  await writeAuditEvent({
    event_type: 'referral_revoked',
    actor_id: revokedBy,
    actor_type: 'user',
    action: `Revoked referral link ${linkId}: ${reason}`,
    target_type: 'referral_link',
    target_id: linkId,
    details: { reason },
  });
}

// ============================================================
// Deactivate expired links (called by cron job)
// ============================================================

export async function deactivateExpiredLinks(): Promise<number> {
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from('referral_links')
    .update({ is_active: false })
    .eq('is_active', true)
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    throw new Error(`Failed to deactivate expired links: ${error.message}`);
  }

  return data?.length ?? 0;
}
