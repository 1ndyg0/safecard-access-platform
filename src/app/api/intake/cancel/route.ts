/**
 * POST /api/intake/cancel
 *
 * The applicant cancels an application that is not complete yet.
 *
 * Staff only receive complete applications (details plus proof of payment).
 * The wizard creates the case, consent and details together at the final
 * submit, so a case only exists here if that submit started and then failed
 * part-way (for example a dropped connection). Cancelling still closes the
 * case, withdraws its consent record and removes any draft profile row, so
 * nothing about the abandoned attempt remains active.
 *
 * A complete application (proof of payment uploaded) cannot be cancelled
 * here: it is already with staff and is handled through support.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/session';
import { requireCaseOwnership } from '@/lib/auth/permissions';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { withdrawConsent } from '@/lib/intake';
import { writeAuditEvent } from '@/lib/audit';
import { badRequest, forbidden, handleApiError, success } from '@/lib/api/response';

/**
 * A case is complete once proof of payment is uploaded; until then it is still in progress.
 * Mirrors the definition in public.admin_applications_view.
 */
const IN_PROGRESS_PAYMENT_STATES = ['not_started', 'official_handoff_opened', 'payer_marked_paid'];

const cancelSchema = z.object({ case_id: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'intake.cancel');
    const parsed = cancelSchema.parse(await request.json());

    const auth = await requireAuth();
    const ownership = await requireCaseOwnership(auth.userId, parsed.case_id);
    if (!ownership.allowed) return forbidden(ownership.reason);

    const admin = getSupabaseAdminClient();
    const { data: caseRecord, error: caseError } = await admin
      .from('recipient_cases')
      .select('id,payment_state,application_state')
      .eq('id', parsed.case_id)
      .maybeSingle();
    if (caseError) throw new Error(`Failed to load case: ${caseError.message}`);
    if (!caseRecord) return badRequest('Application not found.');

    if (!IN_PROGRESS_PAYMENT_STATES.includes(String(caseRecord.payment_state))) {
      return badRequest('This application is already complete and with our team. Please contact support to withdraw it.');
    }

    const { data: consent } = await admin
      .from('consent_records')
      .select('id')
      .eq('case_id', parsed.case_id)
      .eq('state', 'agreed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (consent) {
      // Withdraws the consent record and closes the case in one step.
      await withdrawConsent(parsed.case_id, consent.id as string, 'Applicant cancelled before completing the application.', 'recipient');
    } else {
      const { error } = await admin
        .from('recipient_cases')
        .update({ application_state: 'withdrawn' })
        .eq('id', parsed.case_id);
      if (error) throw new Error(`Failed to close case: ${error.message}`);
    }

    // Remove any draft profile row. A submitted application keeps its
    // immutable snapshot, but a case that never submitted has nothing to keep.
    const { count: submissions } = await admin
      .from('application_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', parsed.case_id);
    if (!submissions) {
      const { error } = await admin.from('recipient_profiles').delete().eq('case_id', parsed.case_id);
      if (error) throw new Error(`Failed to remove draft profile: ${error.message}`);
    }

    await writeAuditEvent({
      event_type: 'data_deletion',
      actor_id: auth.userId,
      actor_type: 'user',
      action: 'Applicant cancelled an incomplete application',
      case_id: parsed.case_id,
      details: { had_submission: Boolean(submissions) },
    });

    return success({ cancelled: true });
  } catch (error) {
    return handleApiError(error, 'Application cancel');
  }
}
