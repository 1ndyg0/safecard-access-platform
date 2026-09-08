/**
 * Sponsor management service
 *
 * Persona: Bea Navarro (student sponsor, 16, minor)
 *
 * Sponsors can:
 * - View campaign info and benefits
 * - Generate referral links/QR codes
 * - Pay through official PRC channels
 * - See privacy-safe referral progress
 *
 * Sponsors CANNOT:
 * - Enter beneficiary personal data
 * - See beneficiary personal information
 * - Automatically enroll from payment
 */

import { getSupabaseAdminClient } from '@/lib/db/client';
import { writeAuditEvent } from '@/lib/audit';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Create sponsor
// ============================================================

export interface CreateSponsorInput {
  campaignId: string;
  authUserId?: string;
  displayName: string;
  isMinor: boolean;
  guardianName?: string;
  guardianContact?: string;
}

export async function createSponsor(
  input: CreateSponsorInput,
): Promise<{ sponsorId: string }> {
  const admin = getSupabaseAdminClient();

  // Check campaign is active and has capacity
  const { data: campaign } = await admin
    .from('pilot_campaigns')
    .select('id, is_active, max_sponsors')
    .eq('id', input.campaignId)
    .single();

  if (!campaign || !campaign.is_active) {
    throw new Error('Campaign not found or not active');
  }

  const { count } = await admin
    .from('sponsors')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', input.campaignId)
    .eq('is_active', true);

  if ((count ?? 0) >= campaign.max_sponsors) {
    throw new Error('Campaign has reached the maximum number of sponsors');
  }

  const sponsorId = uuidv4();

  const { error } = await admin.from('sponsors').insert({
    id: sponsorId,
    campaign_id: input.campaignId,
    auth_user_id: input.authUserId ?? null,
    display_name: input.displayName,
    is_minor: input.isMinor,
    guardian_name: input.guardianName ?? null,
    guardian_contact: input.guardianContact ?? null,
    guardian_approved: false,
  });

  if (error) {
    throw new Error(`Failed to create sponsor: ${error.message}`);
  }

  return { sponsorId };
}

// ============================================================
// Get sponsor profile
// ============================================================

export async function getSponsorProfile(sponsorId: string) {
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from('sponsors')
    .select(`
      id,
      campaign_id,
      display_name,
      is_minor,
      guardian_name,
      guardian_approved,
      is_active,
      created_at
    `)
    .eq('id', sponsorId)
    .single();

  if (error || !data) {
    throw new Error('Sponsor not found');
  }

  return data;
}

// ============================================================
// Get sponsor's privacy-safe referral status
// Shows referral progress WITHOUT exposing recipient data
// ============================================================

export interface SponsorReferralStatus {
  referralLinkId: string;
  slug: string;
  isActive: boolean;
  totalVisits: number;
  totalStarts: number;
  cases: SponsorCaseStatus[];
}

export interface SponsorCaseStatus {
  /** Only show high-level privacy-safe status */
  stage: 'started' | 'consented' | 'submitted' | 'payment_pending' | 'payment_verified' | 'prc_pending' | 'confirmed' | 'declined' | 'withdrawn';
  updatedAt: string;
}

export async function getSponsorReferralStatus(
  sponsorId: string,
): Promise<SponsorReferralStatus[]> {
  const admin = getSupabaseAdminClient();

  // Get all referral links for this sponsor
  const { data: links } = await admin
    .from('referral_links')
    .select('id, slug, is_active, total_visits, total_starts')
    .eq('sponsor_id', sponsorId)
    .order('created_at', { ascending: false });

  if (!links || links.length === 0) return [];

  const result: SponsorReferralStatus[] = [];

  for (const link of links) {
    // Get cases linked to this referral — privacy-safe fields ONLY
    const { data: cases } = await admin
      .from('recipient_cases')
      .select('consent_state, application_state, payment_state, membership_state, updated_at')
      .eq('referral_link_id', link.id)
      .eq('is_active', true);

    const caseStatuses: SponsorCaseStatus[] = (cases ?? []).map((c) => ({
      stage: deriveSponsorVisibleStage(c),
      updatedAt: c.updated_at,
    }));

    result.push({
      referralLinkId: link.id,
      slug: link.slug,
      isActive: link.is_active,
      totalVisits: link.total_visits,
      totalStarts: link.total_starts,
      cases: caseStatuses,
    });
  }

  return result;
}

/**
 * Derive a simple, privacy-safe stage label from the case's state machines.
 * Sponsors see this — NO personal data, NO PRC notes, NO internal details.
 */
function deriveSponsorVisibleStage(c: {
  consent_state: string;
  application_state: string;
  payment_state: string;
  membership_state: string;
}): SponsorCaseStatus['stage'] {
  if (c.application_state === 'withdrawn' || c.consent_state === 'withdrawn') {
    return 'withdrawn';
  }
  if (c.membership_state === 'active_confirmed') return 'confirmed';
  if (c.membership_state === 'declined') return 'declined';
  if (c.membership_state === 'pending_prc_confirmation') return 'prc_pending';
  if (c.payment_state === 'verified_by_official_source') return 'payment_verified';
  if (['official_handoff_opened', 'payer_marked_paid', 'verification_pending'].includes(c.payment_state)) {
    return 'payment_pending';
  }
  if (['submitted', 'resubmitted'].includes(c.application_state)) return 'submitted';
  if (c.consent_state === 'agreed') return 'consented';
  return 'started';
}

// ============================================================
// Approve guardian consent for minor sponsor
// ============================================================

export async function approveGuardianConsent(
  sponsorId: string,
  approvedBy: string,
): Promise<void> {
  const admin = getSupabaseAdminClient();

  const { error } = await admin
    .from('sponsors')
    .update({ guardian_approved: true })
    .eq('id', sponsorId)
    .eq('is_minor', true);

  if (error) {
    throw new Error(`Failed to approve guardian consent: ${error.message}`);
  }

  await writeAuditEvent({
    event_type: 'consent_granted',
    actor_id: approvedBy,
    actor_type: 'user',
    action: `Guardian approved sponsor ${sponsorId} for payment`,
    target_type: 'sponsor',
    target_id: sponsorId,
  });
}

// ============================================================
// List sponsors for a campaign (staff only)
// ============================================================

export async function listCampaignSponsors(
  campaignId: string,
  page = 1,
  limit = 20,
) {
  const admin = getSupabaseAdminClient();
  const offset = (page - 1) * limit;

  const { data, error, count } = await admin
    .from('sponsors')
    .select('id, display_name, is_minor, guardian_approved, is_active, created_at', { count: 'exact' })
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to list sponsors: ${error.message}`);
  }

  return { sponsors: data ?? [], total: count ?? 0, page, limit };
}
