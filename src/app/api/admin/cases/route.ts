/**
 * GET /api/admin/cases
 *
 * The applications list: complete applications only (the view decides what
 * "complete" means), filtered by one status, one search box and an optional
 * date range.
 *
 * Name and mobile number follow the caller's role: a role that may not read a
 * field neither sees it in the response nor can search on it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { assertCampaignAccess, resolveStaffScope, rolesForCampaign } from '@/lib/admin/access';
import { resolveCaseAccessPolicy } from '@/lib/admin/field-policy';
import { handleAdminError, PRIVATE_NO_STORE } from '@/lib/admin/respond';
import { interpretSearch, parseQueueQuery, resolveDateRange } from '@/lib/admin/queue';

export const dynamic = 'force-dynamic';

const LIST_COLUMNS =
  'id,application_ref,status,first_name,middle_name,last_name,mobile_number,received_at,has_payment_proof,rejection_reason,reviewed_at';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const scope = await resolveStaffScope();
    const query = parseQueueQuery(request.nextUrl.searchParams);
    assertCampaignAccess(scope, query.campaign_id);

    const policy = resolveCaseAccessPolicy(rolesForCampaign(scope, query.campaign_id));
    const fields = new Set<string>(policy?.profileFields ?? []);
    const canSeeName = fields.has('first_name') && fields.has('last_name');
    const canSeeMobile = fields.has('mobile_number');

    const admin = getSupabaseAdminClient();
    let builder = admin
      .from('admin_applications_view')
      .select(LIST_COLUMNS, { count: 'exact' })
      .eq('campaign_id', query.campaign_id);

    if (query.status) builder = builder.eq('status', query.status);

    if (query.search) {
      const intent = interpretSearch(query.search);
      if (!intent) {
        return NextResponse.json(emptyResult(query), { headers: PRIVATE_NO_STORE });
      }
      if (intent.kind === 'reference') {
        builder = builder.eq('application_ref', intent.reference);
      } else if (intent.kind === 'mobile') {
        if (!canSeeMobile) return NextResponse.json(emptyResult(query), { headers: PRIVATE_NO_STORE });
        builder = builder.or(intent.patterns.map((pattern) => `mobile_number.ilike.%${pattern}%`).join(','));
      } else {
        if (!canSeeName) return NextResponse.json(emptyResult(query), { headers: PRIVATE_NO_STORE });
        // Every token must match the first or the last name.
        for (const token of intent.tokens) {
          builder = builder.or(`first_name.ilike.%${token}%,last_name.ilike.%${token}%`);
        }
      }
    }

    const { fromIso, toIso } = resolveDateRange(query);
    if (fromIso) builder = builder.gte('received_at', fromIso);
    if (toIso) builder = builder.lte('received_at', toIso);

    builder = builder
      .order('received_at', { ascending: query.sort === 'oldest' })
      // Stable tiebreak so pagination cannot repeat or skip a row.
      .order('id', { ascending: true });

    const offset = (query.page - 1) * query.limit;
    const { data, error, count } = await builder.range(offset, offset + query.limit - 1);
    if (error) throw new Error(`Failed to list applications: ${error.message}`);

    const applications = (data ?? []).map((row) => ({
      id: row.id as string,
      application_ref: row.application_ref as string | null,
      status: row.status as string,
      applicant_name: canSeeName
        ? [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || null
        : null,
      mobile_number: canSeeMobile ? ((row.mobile_number as string | null) ?? null) : null,
      received_at: row.received_at as string,
      has_payment_proof: Boolean(row.has_payment_proof),
      rejection_reason: (row.rejection_reason as string | null) ?? null,
    }));

    const total = count ?? 0;
    return NextResponse.json(
      {
        applications,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
      },
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error) {
    return handleAdminError(error, 'Admin applications list');
  }
}

function emptyResult(query: { page: number; limit: number }) {
  return {
    applications: [],
    pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 1 },
  };
}
