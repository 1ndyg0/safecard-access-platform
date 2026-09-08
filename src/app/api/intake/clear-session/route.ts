/**
 * POST /api/intake/clear-session
 *
 * Shared-device "Clear my info" endpoint.
 *
 * When a recipient is done on a shared phone, this:
 * 1. Signs out the anonymous session
 * 2. Clears any client-side session indicators
 *
 * Does NOT delete data — the case and profile persist.
 * The recipient can return later with their referral link
 * to resume (a new anonymous session is created, linked by referral).
 *
 * This is a privacy feature for the shared-phone context.
 */

import { NextRequest } from 'next/server';
import { getSessionClient } from '@/lib/auth/session';
import { writeAuditEvent } from '@/lib/audit';
import { success, handleApiError } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSessionClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Record the session clear before signing out
      await writeAuditEvent({
        event_type: 'session_cleared',
        actor_id: user.id,
        actor_type: 'user',
        action: 'Recipient cleared shared-device session',
        details: {
          is_anonymous: user.is_anonymous ?? false,
          user_agent_present: Boolean(request.headers.get('user-agent')),
        },
      });

      // Sign out the anonymous session
      await supabase.auth.signOut();
    }

    // Return response with cache-busting headers
    const response = success({
      cleared: true,
      message: {
        tl: 'Ang iyong session ay na-clear na. Ligtas nang ibigay ang phone sa iba.',
        en: 'Your session has been cleared. It is now safe to hand the phone to someone else.',
        ceb: 'Ang imong session kay na-clear na. Luwas na ihatag ang phone sa uban.',
      },
    });

    // Set headers to prevent caching of the cleared state
    response.headers.set('Clear-Site-Data', '"cookies", "storage"');
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

    return response;
  } catch (error) {
    return handleApiError(error, 'Session clear');
  }
}
