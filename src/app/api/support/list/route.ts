/**
 * GET /api/support/list?campaign_id=xxx&state=xxx&category=xxx&priority=xxx
 *
 * Staff-only: list support cases with filters.
 * Returns cases ordered by priority (critical first), then created_at.
 */

import { NextRequest } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { success, badRequest, forbidden, handleApiError } from '@/lib/api/response';

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const campaignId = request.nextUrl.searchParams.get('campaign_id');
    if (!campaignId) return badRequest('campaign_id is required');
    const roleCheck = await requireAnyRole(auth.userId, [
      'privacy_admin_owner', 'school_admin', 'prc_liaison', 'support_agent',
    ], campaignId);
    if (!roleCheck.allowed) return forbidden(roleCheck.reason);

    const state = request.nextUrl.searchParams.get('state');
    const category = request.nextUrl.searchParams.get('category');
    const priority = request.nextUrl.searchParams.get('priority');
    const page = parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '25', 10), 100);
    const offset = (page - 1) * limit;

    const admin = getSupabaseAdminClient();

    let query = admin
      .from('support_cases')
      .select(`
        id, case_id, category, subject, description, submitted_by_type,
        state, assigned_to, priority, resolution_summary, resolved_at,
        created_at, updated_at
      `, { count: 'exact' })
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (state) query = query.eq('state', state);
    if (category) query = query.eq('category', category);
    if (priority) query = query.eq('priority', priority);

    const { data, error, count } = await query;

    if (error) throw new Error(`Failed to list support cases: ${error.message}`);

    // Sort by priority (critical first), preserving created_at order within same priority
    const sorted = (data ?? []).sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 4;
      const pb = PRIORITY_ORDER[b.priority] ?? 4;
      return pa - pb;
    });

    return success({
      cases: sorted,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, 'Support case list');
  }
}
