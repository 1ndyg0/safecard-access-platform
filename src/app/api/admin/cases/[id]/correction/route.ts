import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { writeAuditEvent } from '@/lib/audit';
import { validateApplicationTransition } from '@/lib/state-machines';
import { handleApiError } from '@/lib/api/response';

const schema = z.object({ reason: z.string().trim().min(5).max(500) });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireStaffAuth();
    const { id } = await context.params;
    const { reason } = schema.parse(await request.json());
    const admin = getSupabaseAdminClient();
    const { data: caseRecord } = await admin.from('recipient_cases').select('id,campaign_id,application_state').eq('id', id).single();
    if (!caseRecord) return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
    const access = await requireAnyRole(auth.userId, ['privacy_admin_owner', 'school_admin', 'prc_liaison'], caseRecord.campaign_id);
    if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: 403 });
    validateApplicationTransition(caseRecord.application_state, 'correction_needed');
    const { data: submission } = await admin.from('application_submissions').select('id').eq('case_id', id).eq('is_current', true).maybeSingle();
    if (submission) await admin.from('application_submissions').update({ correction_reason: reason }).eq('id', submission.id);
    const { error } = await admin.from('recipient_cases').update({ application_state: 'correction_needed', metadata: { correction_reason: reason, correction_requested_at: new Date().toISOString() } }).eq('id', id);
    if (error) throw new Error(`Correction request could not be recorded: ${error.message}`);
    await writeAuditEvent({ event_type: 'data_correction', actor_id: auth.userId, actor_type: 'user', action: 'Requested application correction', case_id: id, target_type: 'recipient_case', target_id: id, details: { reason } });
    return NextResponse.json({ requested: true, application_state: 'correction_needed' });
  } catch (error) {
    return handleApiError(error, 'Application correction request');
  }
}
