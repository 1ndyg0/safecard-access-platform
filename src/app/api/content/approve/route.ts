/**
 * POST /api/content/approve
 *
 * PRC liaison approves a content version.
 * Approval is required before school admin can publish.
 *
 * Persona: Elena (PRC liaison) reviews and approves content.
 */

import { NextRequest } from 'next/server';
import { approveContent } from '@/lib/content';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/permissions';
import { success, forbidden, handleApiError } from '@/lib/api/response';
import { z } from 'zod';

const approveContentSchema = z.object({
  content_version_id: z.string().uuid(),
  approval_notes: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const roleCheck = await requireRole(auth.userId, 'prc_liaison');
    if (!roleCheck.allowed) return forbidden('Only PRC liaison can approve content');

    const body = await request.json();
    const parsed = approveContentSchema.parse(body);

    await approveContent(parsed.content_version_id, auth.userId);

    return success({
      approved: true,
      message: 'Content approved by PRC — ready for school admin to publish',
    });
  } catch (error) {
    return handleApiError(error, 'Content approval');
  }
}
