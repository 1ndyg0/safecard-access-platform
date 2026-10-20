/**
 * GET /api/metrics/funnel?campaign_id=xxx
 *
 * Completion funnel: how recipients progress through the intake journey.
 * Staff-only. Returns counts at each stage with suppression.
 *
 * Stages: case_started → consent_granted → application_submitted →
 *         payment_started → payment_confirmed → application_approved
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
      'privacy_admin_owner', 'school_admin', 'support_agent',
    ], campaignId);
    if (!roleCheck.allowed) return forbidden(roleCheck.reason);

    const admin = getSupabaseAdminClient();

    // Get all cases for the campaign
    const { data: cases, error } = await admin
      .from('recipient_cases')
      .select('consent_state, application_state, payment_state, application_review_state')
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

    const applicationApproved = all.filter(
      (c) => c.application_review_state === 'approved',
    ).length;

    const funnel = {
      case_started: suppress(total),
      consent_granted: suppress(consentGranted),
      application_submitted: suppress(applicationSubmitted),
      payment_started: suppress(paymentStarted),
      payment_confirmed: suppress(paymentConfirmed),
      application_approved: suppress(applicationApproved),
    };

    // Conversion rates (only where both stages are not suppressed)
    const conversions: Record<string, number | null> = {};
    const pairs = [
      ['case_to_consent', total, consentGranted],
      ['consent_to_submission', consentGranted, applicationSubmitted],
      ['submission_to_payment', applicationSubmitted, paymentStarted],
      ['payment_to_confirmed', paymentStarted, paymentConfirmed],
      ['confirmed_to_approved', paymentConfirmed, applicationApproved],
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
