import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { handleApiError } from '@/lib/api/response';

const schema = z.object({
  decision: z.enum(['approved', 'resubmission_requested', 'rejected']),
  reason: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  if (value.decision !== 'approved' && (!value.reason || value.reason.length < 5)) {
    context.addIssue({ code: 'custom', path: ['reason'], message: 'A clear reason of at least 5 characters is required.' });
  }
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireStaffAuth();
    const { id } = await context.params;
    const parsed = schema.parse(await request.json());
    const admin = getSupabaseAdminClient();
    const { data: caseRecord } = await admin.from('recipient_cases').select('id,campaign_id').eq('id', id).maybeSingle();
    if (!caseRecord) return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
    const access = await requireAnyRole(auth.userId, ['privacy_admin_owner', 'school_admin', 'prc_liaison'], caseRecord.campaign_id);
    if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: 403 });

    const { data, error } = await admin.rpc('record_application_review', {
      p_case_id: id,
      p_reviewed_by: auth.userId,
      p_decision: parsed.decision,
      p_reason: parsed.reason ?? null,
    });
    if (error) throw new Error(`Application review could not be committed atomically: ${error.message}`);

    const result = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ reviewed: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error, 'Application review decision');
  }
}
