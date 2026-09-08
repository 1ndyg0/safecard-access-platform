/**
 * POST /api/consent/withdraw
 *
 * Withdraw consent. Stops applicable processing and reminders.
 * Also withdraws the application if in progress.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withdrawConsent } from '@/lib/intake';
import { withdrawConsentSchema } from '@/lib/validation/schemas';
import { requireAuth } from '@/lib/auth/session';
import { requireCaseOwnership } from '@/lib/auth/permissions';
import { enforceRateLimit } from '@/lib/api/rate-limit';

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'consent.withdraw');
    const body = await request.json();
    const parsed = withdrawConsentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const auth = await requireAuth();
    const ownership = await requireCaseOwnership(auth.userId, parsed.data.case_id);
    if (!ownership.allowed) {
      return NextResponse.json({ error: ownership.reason }, { status: 403 });
    }

    await withdrawConsent(
      parsed.data.case_id,
      parsed.data.consent_record_id,
      parsed.data.reason,
      parsed.data.requested_by,
    );

    return NextResponse.json({
      success: true,
      message: 'Consent withdrawn. Processing and reminders have been stopped.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Withdrawal failed';
    console.error('[API] Consent withdrawal failed');

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to withdraw consent' },
      { status: 500 }
    );
  }
}
