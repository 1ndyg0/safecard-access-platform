/**
 * GET /api/admin/cases?campaign_id=xxx&state=xxx&page=1&limit=25
 *
 * Staff view of all recipient cases with filters.
 * Does NOT expose recipient_profiles PII — only case metadata.
 * Privacy boundary: sponsors and staff see state machines, not personal data.
 */

import { NextRequest } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { success, badRequest, forbidden, handleApiError } from '@/lib/api/response';
import { z } from 'zod';

const stateFilterSchema = z.enum([
  'not_started', 'reviewing', 'agreed', 'withdrawn', 'expired_due_to_content_change',
  'draft', 'ready_for_review', 'submitted', 'correction_needed', 'resubmitted',
  'official_handoff_opened', 'payer_marked_paid', 'verification_pending',
  'verified_by_official_source', 'failed_or_cancelled', 'refunded_or_reversed',
  'not_ready', 'ready_for_export', 'exported', 'acknowledged', 'correction_requested',
  'accepted', 'rejected', 'not_active', 'pending_prc_confirmation',
  'active_confirmed', 'declined', 'expired', 'renewed',
]);
const consentFilterSchema = z.enum(['not_started', 'reviewing', 'agreed', 'withdrawn', 'expired_due_to_content_change']);
const applicationFilterSchema = z.enum(['draft', 'ready_for_review', 'submitted', 'correction_needed', 'resubmitted', 'withdrawn']);
const paymentFilterSchema = z.enum(['not_started', 'official_handoff_opened', 'payer_marked_paid', 'verification_pending', 'verified_by_official_source', 'failed_or_cancelled', 'refunded_or_reversed']);

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const campaignId = request.nextUrl.searchParams.get('campaign_id');
    if (!campaignId) return badRequest('campaign_id is required');
    const roleCheck = await requireAnyRole(auth.userId, [
      'privacy_admin_owner', 'school_admin', 'prc_liaison', 'support_agent', 'finance_export',
    ], campaignId);
    if (!roleCheck.allowed) return forbidden(roleCheck.reason);

    const state = stateFilterSchema.optional().parse(request.nextUrl.searchParams.get('state') ?? undefined);
    const consentState = consentFilterSchema.optional().parse(request.nextUrl.searchParams.get('consent_state') ?? undefined);
    const applicationState = applicationFilterSchema.optional().parse(request.nextUrl.searchParams.get('application_state') ?? undefined);
    const paymentState = paymentFilterSchema.optional().parse(request.nextUrl.searchParams.get('payment_state') ?? undefined);
    const page = z.coerce.number().int().min(1).parse(request.nextUrl.searchParams.get('page') ?? 1);
    const limit = z.coerce.number().int().min(1).max(100).parse(request.nextUrl.searchParams.get('limit') ?? 25);
    const search = request.nextUrl.searchParams.get('q')?.trim();
    const sort = z.enum(['newest', 'oldest', 'longest_waiting']).catch('newest').parse(request.nextUrl.searchParams.get('sort') ?? 'newest');
    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');
    const offset = (page - 1) * limit;

    const admin = getSupabaseAdminClient();

    // Select case metadata — NOT recipient_profiles
    let query = admin
      .from('recipient_cases')
      .select(
        `id, application_ref, campaign_id,
         consent_state, application_state, payment_state,
         prc_handoff_state, membership_state,
         created_at, updated_at`,
        { count: 'exact' },
      )
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: sort !== 'newest' })
      .range(offset, offset + limit - 1);

    if (search) query = query.eq('application_ref', search);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', `${to}T23:59:59.999Z`);

    if (state) {
      // Generic state filter — search across all state machines
      query = query.or(
        `consent_state.eq.${state},application_state.eq.${state},payment_state.eq.${state},prc_handoff_state.eq.${state},membership_state.eq.${state}`,
      );
    }

    if (consentState) query = query.eq('consent_state', consentState);
    if (applicationState) query = query.eq('application_state', applicationState);
    if (paymentState) query = query.eq('payment_state', paymentState);

    const { data, error, count } = await query;

    if (error) throw new Error(`Failed to list cases: ${error.message}`);

    return success({
      cases: data ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, 'Admin case list');
  }
}
