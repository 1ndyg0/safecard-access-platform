/**
 * POST /api/intake/case
 *
 * Create a new recipient case.
 * Can be linked to a referral (optional attribution).
 * Creates an anonymous Supabase auth session if needed.
 *
 * Journey phase 3: Learn and Decide → creates the case container
 * Journey phase 4: Agreement and Application Intake
 */

import { NextRequest } from 'next/server';
import { createRecipientCase } from '@/lib/intake';
import { getAuthContext } from '@/lib/auth/session';
import { getSessionClient } from '@/lib/auth/session';
import { requireActiveCampaign } from '@/lib/auth/permissions';
import { created, badRequest, handleApiError } from '@/lib/api/response';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/api/rate-limit';

const createCaseSchema = z.object({
  campaign_id: z.string().uuid(),
  referral_link_id: z.string().uuid().optional(),
  decision: z.enum(['accept', 'ask', 'decline']),
});

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'intake.case');
    const body = await request.json();
    const parsed = createCaseSchema.parse(body);

    if (parsed.decision === 'ask') {
      return created({
        caseId: null,
        decision: 'ask',
        prcContact: { hotline: '143' },
        message: 'No personal data was collected. You may return and apply later.',
      });
    }
    if (parsed.decision === 'decline') {
      return created({
        caseId: null,
        decision: 'decline',
        message: 'No personal data was collected and the sponsor will not be notified.',
      });
    }

    // Verify campaign is active
    const campaignCheck = await requireActiveCampaign(parsed.campaign_id);
    if (!campaignCheck.allowed) {
      return badRequest(campaignCheck.reason!);
    }

    // Get or create anonymous auth session
    const auth = await getAuthContext();
    let authUserId = auth?.userId;

    if (!authUserId) {
      // Create an anonymous session for the recipient
      const supabase = await getSessionClient();
      const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();

      if (anonError || !anonData.user) {
        return badRequest('Failed to create session. Please try again.');
      }
      authUserId = anonData.user.id;
    }

    const result = await createRecipientCase({
      campaignId: parsed.campaign_id,
      referralLinkId: parsed.referral_link_id,
      authUserId,
    });

    return created({
      caseId: result.caseId,
      decision: 'accept',
      message: 'Case created. You can now review information and decide whether to proceed.',
    });
  } catch (error) {
    return handleApiError(error, 'Case creation');
  }
}
