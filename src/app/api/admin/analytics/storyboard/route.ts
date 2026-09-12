/**
 * GET /api/admin/analytics/storyboard?days=30
 *
 * Authorized aggregate reporting for the admin dashboard.
 *
 * Aggregation and suppression both happen in PostgreSQL. This route
 * checks the caller holds a staff role and returns what the function
 * gives it; there is no path here that reads a raw event row, which is
 * what keeps the event stream unenumerable.
 *
 * This is a read-only addition to the admin surface. It does not modify
 * the dashboard owned by the operations module.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyStaffRole } from '@/lib/auth/permissions';
import { badRequest, forbidden, handleApiError } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireStaffAuth();
    const access = await requireAnyStaffRole(auth.userId);
    if (!access.allowed) return forbidden('Staff role required.');

    const parsedDays = z.coerce
      .number()
      .int()
      .min(1)
      .max(365)
      .safeParse(request.nextUrl.searchParams.get('days') ?? 30);
    if (!parsedDays.success) return badRequest('days must be between 1 and 365.');

    const { data, error } = await getSupabaseAdminClient().rpc('storyboard_analytics', {
      p_days: parsedDays.data,
    });
    if (error) throw new Error(`Failed to load storyboard analytics: ${error.message}`);

    return NextResponse.json(
      { analytics: data },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return handleApiError(error, 'Storyboard analytics');
  }
}
