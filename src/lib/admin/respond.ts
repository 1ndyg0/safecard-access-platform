/**
 * Shared error mapping for admin routes.
 *
 * Keeps the access errors defined by this module out of the platform's
 * generic handler, which is shared with every other module.
 */

import type { NextResponse } from 'next/server';
import { forbidden, handleApiError } from '@/lib/api/response';
import { CampaignAccessError, NoStaffAssignmentError } from '@/lib/admin/access';

export function handleAdminError(error: unknown, context: string): NextResponse {
  if (error instanceof NoStaffAssignmentError) return forbidden(error.message);
  if (error instanceof CampaignAccessError) return forbidden(error.message);
  return handleApiError(error, context);
}

/** Admin responses are per-user and must never be cached by a proxy. */
export const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' } as const;
