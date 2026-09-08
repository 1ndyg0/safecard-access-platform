/**
 * POST /api/support
 *
 * Create a support case. Accessible to all users (authenticated or anonymous).
 * Emergency/claims requests are flagged urgent and point to PRC contacts.
 * Privacy requests are auto-prioritized to high.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupportCase } from '@/lib/support';
import { createSupportCaseSchema } from '@/lib/validation/schemas';
import { requireAuth } from '@/lib/auth/session';
import { requireCaseOwnership } from '@/lib/auth/permissions';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { assertSyntheticText } from '@/lib/safety/data-mode';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { handleApiError } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'support.create', 5);
    const body = await request.json();
    const parsed = createSupportCaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const auth = await requireAuth();
    const admin = getSupabaseAdminClient();
    let campaignId = parsed.data.campaign_id;
    let submittedByType: 'recipient' | 'sponsor' | 'staff' = 'recipient';
    if (parsed.data.case_id) {
      const ownership = await requireCaseOwnership(auth.userId, parsed.data.case_id);
      if (!ownership.allowed) {
        return NextResponse.json({ error: ownership.reason }, { status: 403 });
      }
      const { data: ownedCase } = await admin
        .from('recipient_cases')
        .select('campaign_id')
        .eq('id', parsed.data.case_id)
        .single();
      campaignId = ownedCase?.campaign_id;
    } else if (!auth.isAnonymous) {
      const { data: staff } = await admin.from('users').select('id').eq('id', auth.userId).maybeSingle();
      submittedByType = staff ? 'staff' : 'sponsor';
    }
    assertSyntheticText(
      parsed.data.data_mode,
      `${parsed.data.subject} ${parsed.data.description} ${parsed.data.contact_method ?? ''}`,
    );

    const result = await createSupportCase({
      caseId: parsed.data.case_id,
      campaignId,
      category: parsed.data.category,
      subject: parsed.data.subject,
      description: parsed.data.description,
      submittedByType,
      submittedByUserId: auth.userId,
      contactMethod: parsed.data.contact_method,
      isPrivacyRequest: parsed.data.is_privacy_request,
      privacyRequestType: parsed.data.privacy_request_type,
      idempotencyKey: parsed.data.idempotency_key,
    });

    // If emergency/claims, include PRC contacts in response
    let prcContacts: Record<string, string> | undefined;
    if (parsed.data.category === 'emergency_claims_education') {
      prcContacts = {
        hotline: '143',
        description: 'Philippine Red Cross Hotline — for emergency ambulance and blood services',
        note: 'The SafeCard platform does not process claims. Contact PRC directly.',
      };
    }

    return NextResponse.json(
      {
        supportCaseId: result.supportCaseId,
        status: result.status,
        prcContacts,
      },
      { status: result.status === 'created' ? 201 : 200 }
    );
  } catch (error) {
    return handleApiError(error, 'Support case creation');
  }
}
