/**
 * GET /api/admin/cases
 *
 * Submission queue for authorized staff.
 *
 * Filters are independent: each targets one column with a value from
 * that column's own enum type. The previous implementation OR'd a single
 * value across all five state columns, which raises
 * `invalid input value for enum` in PostgreSQL for any value that is not
 * a label of every enum involved — a 500 for most selections.
 *
 * Sorting by longest waiting uses review_waiting_since, the moment the
 * case entered its current review wait. A case that was sent back for
 * correction and resubmitted has waited since the resubmission, not
 * since it was created, and must not jump the queue on age alone.
 *
 * Response rows carry case metadata only. No profile column is selected
 * here; the queue never needs a name to show a state.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { assertCampaignAccess, resolveStaffScope } from '@/lib/admin/access';
import { handleAdminError, PRIVATE_NO_STORE } from '@/lib/admin/respond';
import { parseQueueQuery, resolveDateRange, reviewBucketStates } from '@/lib/admin/queue';

export const dynamic = 'force-dynamic';

/**
 * Explicit column list, written as a literal so the row typing survives
 * and the disclosed columns are visible at a glance. No profile column
 * appears here: the queue shows states, never people.
 */
const QUEUE_COLUMNS =
  'id,campaign_id,application_ref,consent_state,application_state,payment_state,prc_handoff_state,membership_state,created_at,updated_at,review_waiting_since,is_resubmission';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const scope = await resolveStaffScope();
    const query = parseQueueQuery(request.nextUrl.searchParams);
    assertCampaignAccess(scope, query.campaign_id);

    const admin = getSupabaseAdminClient();
    let builder = admin
      .from('admin_case_queue_view')
      .select(QUEUE_COLUMNS, { count: 'exact' })
      .eq('campaign_id', query.campaign_id);

    // Exact reference match only. A prefix search over a unique
    // identifier is a way to enumerate the register.
    if (query.application_ref) {
      builder = builder.eq('application_ref', query.application_ref);
    }

    if (query.consent_state) builder = builder.eq('consent_state', query.consent_state);
    if (query.application_state) {
      builder = builder.eq('application_state', query.application_state);
    }
    if (query.review_bucket) {
      builder = builder.in('application_state', [...reviewBucketStates(query.review_bucket)]);
    }
    if (query.payment_state) builder = builder.eq('payment_state', query.payment_state);
    if (query.prc_handoff_state) {
      builder = builder.eq('prc_handoff_state', query.prc_handoff_state);
    }
    if (query.membership_state) {
      builder = builder.eq('membership_state', query.membership_state);
    }

    const { fromIso, toIso } = resolveDateRange(query);
    if (fromIso) builder = builder.gte('created_at', fromIso);
    if (toIso) builder = builder.lte('created_at', toIso);

    switch (query.sort) {
      case 'oldest':
        builder = builder.order('created_at', { ascending: true });
        break;
      case 'longest_waiting':
        // Oldest wait first. Cases not awaiting review carry a null
        // wait timestamp and sort last rather than to the top.
        builder = builder.order('review_waiting_since', {
          ascending: true,
          nullsFirst: false,
        });
        break;
      case 'newest':
      default:
        builder = builder.order('created_at', { ascending: false });
        break;
    }
    // Stable tiebreak so pagination cannot repeat or skip a row.
    builder = builder.order('id', { ascending: true });

    const offset = (query.page - 1) * query.limit;
    const { data, error, count } = await builder.range(offset, offset + query.limit - 1);
    if (error) throw new Error(`Failed to list cases: ${error.message}`);

    const total = count ?? 0;
    return NextResponse.json(
      {
        cases: data ?? [],
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
        appliedFilters: {
          consent_state: query.consent_state ?? null,
          application_state: query.application_state ?? null,
          review_bucket: query.review_bucket ?? null,
          payment_state: query.payment_state ?? null,
          prc_handoff_state: query.prc_handoff_state ?? null,
          membership_state: query.membership_state ?? null,
          application_ref: query.application_ref ?? null,
          from: query.from ?? null,
          to: query.to ?? null,
          sort: query.sort,
        },
        // Stated rather than implied: the console labels its date range
        // so a reviewer knows which day boundary they filtered on.
        dateRangeTimezone: 'UTC',
      },
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error) {
    return handleAdminError(error, 'Admin case list');
  }
}
