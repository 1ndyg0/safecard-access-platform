import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveStaffScope } from '@/lib/admin/access';
import { writeAuditEvent } from '@/lib/audit';
import { handleAdminError, PRIVATE_NO_STORE } from '@/lib/admin/respond';

const bodySchema = z.strictObject({ action: z.enum(['login', 'logout']) });

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = bodySchema.parse(await request.json());
    const scope = await resolveStaffScope();
    const auditId = await writeAuditEvent({
      event_type: 'staff_login',
      actor_id: scope.userId,
      actor_type: 'user',
      action: parsed.action === 'login' ? 'Staff session established' : 'Staff session ended',
      details: { roles: scope.roles, campaign_ids: scope.campaignIds },
      severity: 'info',
    });
    if (!auditId) throw new Error('Staff session audit could not be recorded.');
    return NextResponse.json({ recorded: true }, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    return handleAdminError(error, 'Staff session audit');
  }
}
