/**
 * GET /api/metrics/funnel?campaign_id=xxx
 *
 * Completion funnel: how recipients progress through the intake journey.
 * Staff-only. Returns counts at each stage with suppression.
 *
 * Stages: referral_visited → case_started → consent_granted →
 *         profile_saved → application_submitted → payment_started →
 *         payment_confirmed → exported_to_prc → membership_active
 */

import { NextRequest } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { success, badRequest, forbidden, handleApiError } from '@/lib/api/response';

const SUPPRESSION_THRESHOLD = 5;

function suppress(count: number): number | null {
  return count < SUPPRESSION_THRESHOLD && count > 0 ? null : count;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const campaignId = request.nextUrl.searchParams.get('campaign_id');
    if (!campaignId) return badRequest('campaign_id is required');
    const roleCheck = await requireAnyRole(auth.userId, [
      'privacy_admin_owner', 'school_admin', 'prc_liaison', 'support_agent', 'finance_export',
    ], campaignId);
    if (!roleCheck.allowed) return forbidden(roleCheck.reason);

    const admin = getSupabaseAdminClient();

    // Get all cases for the campaign
    const { data: cases, error } = await admin
      .from('recipient_cases')
      .select('consent_state, application_state, payment_state, prc_handoff_state, membership_state')
      .eq('campaign_id', campaignId);

    if (error) throw new Error(`Failed to fetch funnel data: ${error.message}`);

    const all = cases ?? [];
    const total = all.length;

    // Count how many reached each stage
    const consentGranted = all.filter(
      (c) => c.consent_state !== 'not_started' && c.consent_state !== 'expired',
    ).length;

    const applicationSubmitted = all.filter(
      (c) => c.application_state !== 'not_started' && c.application_state !== 'draft',
    ).length;

    const paymentStarted = all.filter(
      (c) => c.payment_state !== 'not_started',
    ).length;

    const paymentConfirmed = all.filter(
      (c) => c.payment_state === 'verified_by_official_source',
    ).length;

    const exportedToPrc = all.filter(
      (c) => ['exported', 'acknowledged', 'correction_requested', 'accepted', 'rejected'].includes(c.prc_handoff_state),
    ).length;

    const membershipActive = all.filter(
      (c) => c.membership_state === 'active_confirmed',
    ).length;

    // Get referral visit count separately (from referral_links)
    const { data: referrals } = await admin
      .from('referral_links')
      .select('total_visits')
      .eq('campaign_id', campaignId);

    const totalVisits = (referrals ?? []).reduce(
      (sum, r) => sum + (r.total_visits ?? 0),
      0,
    );

    const funnel = {
      referral_visited: suppress(totalVisits),
      case_started: suppress(total),
      consent_granted: suppress(consentGranted),
      application_submitted: suppress(applicationSubmitted),
      payment_started: suppress(paymentStarted),
      payment_confirmed: suppress(paymentConfirmed),
      exported_to_prc: suppress(exportedToPrc),
      membership_active: suppress(membershipActive),
    };

    // Conversion rates (only where both stages are not suppressed)
    const conversions: Record<string, number | null> = {};
    const pairs = [
      ['referral_to_case', totalVisits, total],
      ['case_to_consent', total, consentGranted],
      ['consent_to_submission', consentGranted, applicationSubmitted],
      ['submission_to_payment', applicationSubmitted, paymentStarted],
      ['payment_to_confirmed', paymentStarted, paymentConfirmed],
      ['confirmed_to_export', paymentConfirmed, exportedToPrc],
      ['export_to_active', exportedToPrc, membershipActive],
    ] as const;

    for (const [label, from, to] of pairs) {
      if (from < SUPPRESSION_THRESHOLD || to < SUPPRESSION_THRESHOLD) {
        conversions[label] = null;
      } else if (from === 0) {
        conversions[label] = 0;
      } else {
        conversions[label] = Math.round((to / from) * 10000) / 100; // percentage with 2 decimals
      }
    }

    return success({
      campaignId,
      funnel,
      conversions,
      note: 'null values are suppressed (cohort < 5) to protect privacy',
    });
  } catch (error) {
    return handleApiError(error, 'Funnel metrics');
  }
}
