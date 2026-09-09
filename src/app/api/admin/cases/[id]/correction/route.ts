import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { writeAuditEvent } from '@/lib/audit';
import { handleApiError } from '@/lib/api/response';

const schema = z.object({ reason: z.string().trim().min(5).max(500) });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireStaffAuth();
    const { id } = await context.params;
    const { reason } = schema.parse(await request.json());
    const admin = getSupabaseAdminClient();
    const { data: caseRecord } = await admin.from('recipient_cases').select('id,campaign_id').eq('id', id).single();
    if (!caseRecord) return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
    const access = await requireAnyRole(auth.userId, ['privacy_admin_owner', 'school_admin', 'prc_liaison'], caseRecord.campaign_id);
    if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: 403 });
    const { error } = await admin.rpc('record_application_review', {
      p_case_id: id,
      p_reviewed_by: auth.userId,
      p_decision: 'resubmission_requested',
      p_reason: reason,
    });
    if (error) throw new Error(`Correction request could not be recorded atomically: ${error.message}`);
    await writeAuditEvent({ event_type: 'data_correction', actor_id: auth.userId, actor_type: 'user', action: 'Requested application correction', case_id: id, target_type: 'recipient_case', target_id: id, details: { reason } });
    return NextResponse.json({ requested: true, application_state: 'correction_needed' });
  } catch (error) {
    return handleApiError(error, 'Application correction request');
  }
}
