/**
 * POST /api/content/approve
 *
 * A content approver (or the privacy administrator) approves a content
 * version. Approval is required before school admin can publish.
 */

import { NextRequest } from 'next/server';
import { approveContent } from '@/lib/content';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { success, forbidden, handleApiError } from '@/lib/api/response';
import { z } from 'zod';

const approveContentSchema = z.object({
  content_version_id: z.string().uuid(),
  approval_notes: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const roleCheck = await requireAnyRole(auth.userId, ['content_approver', 'privacy_admin_owner']);
    if (!roleCheck.allowed) return forbidden('Only a content approver can approve content');

    const body = await request.json();
    const parsed = approveContentSchema.parse(body);

    await approveContent(parsed.content_version_id, auth.userId);

    return success({
      approved: true,
      message: 'Content approved — ready for school admin to publish',
    });
  } catch (error) {
    return handleApiError(error, 'Content approval');
  }
}
