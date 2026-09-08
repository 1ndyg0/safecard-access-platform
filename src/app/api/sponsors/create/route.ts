/**
 * POST /api/sponsors/create
 *
 * Register a new sponsor for a campaign.
 * Checks campaign capacity. Minor sponsors require guardian info.
 */

import { NextRequest } from 'next/server';
import { createSponsor } from '@/lib/sponsors';
import { createSponsorSchema } from '@/lib/validation/schemas';
import { requireAuth } from '@/lib/auth/session';
import { created, handleApiError } from '@/lib/api/response';
import { assertSponsorDataAllowed } from '@/lib/safety/data-mode';
import { enforceRateLimit } from '@/lib/api/rate-limit';

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'sponsor.create', 10);
    const body = await request.json();
    const parsed = createSponsorSchema.parse(body);

    const auth = await requireAuth();
    assertSponsorDataAllowed(parsed.data_mode, {
      displayName: parsed.display_name,
      guardianName: parsed.guardian_name,
      guardianContact: parsed.guardian_contact,
    });

    const result = await createSponsor({
      campaignId: parsed.campaign_id,
      authUserId: auth.userId,
      displayName: parsed.display_name,
      isMinor: parsed.is_minor,
      guardianName: parsed.guardian_name,
      guardianContact: parsed.guardian_contact,
    });

    return created({
      sponsorId: result.sponsorId,
      message: 'Sponsor registered successfully',
    });
  } catch (error) {
    return handleApiError(error, 'Sponsor creation');
  }
}
