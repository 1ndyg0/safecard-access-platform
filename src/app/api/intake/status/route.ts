/**
 * GET /api/intake/status?case_id=xxx
 *
 * Recipient: see their own case status across all state machines.
 * Returns the application reference, current states, and next actions.
 *
 * Journey phase 7: Membership Verification and Confirmation
 * The recipient checks their status here.
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { requireCaseOwnership } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { success, badRequest, forbidden, handleApiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const caseId = request.nextUrl.searchParams.get('case_id');

    if (!caseId) return badRequest('case_id is required');

    const ownership = await requireCaseOwnership(auth.userId, caseId);
    if (!ownership.allowed) return forbidden(ownership.reason);

    const admin = getSupabaseAdminClient();

    // Get case with all state machines
    const { data: caseRecord } = await admin
      .from('recipient_cases')
      .select(`
        id,
        application_ref,
        consent_state,
        application_state,
        payment_state,
        prc_handoff_state,
        membership_state,
        created_at,
        updated_at
      `)
      .eq('id', caseId)
      .single();

    if (!caseRecord) return badRequest('Case not found');

    // Get membership details if confirmed
    let membershipDetails: Record<string, unknown> | null = null;
    if (caseRecord.membership_state === 'active_confirmed') {
      const { data: membershipEvent } = await admin
        .from('membership_status_events')
        .select('prc_membership_id, prc_effective_date, prc_expiry_date, created_at')
        .eq('case_id', caseId)
        .eq('new_state', 'active_confirmed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (membershipEvent) {
        membershipDetails = {
          safeCardId: membershipEvent.prc_membership_id,
          effectiveDate: membershipEvent.prc_effective_date,
          expiryDate: membershipEvent.prc_expiry_date,
          confirmedAt: membershipEvent.created_at,
        };
      }
    }

    // Determine next action for the recipient
    const nextAction = deriveNextAction(caseRecord);

    return success({
      caseId: caseRecord.id,
      applicationRef: caseRecord.application_ref,
      states: {
        consent: caseRecord.consent_state,
        application: caseRecord.application_state,
        payment: caseRecord.payment_state,
        prcHandoff: caseRecord.prc_handoff_state,
        membership: caseRecord.membership_state,
      },
      membership: membershipDetails,
      nextAction,
      prcContacts: {
        hotline: '143',
        description: 'Philippine Red Cross Hotline',
      },
      updatedAt: caseRecord.updated_at,
    });
  } catch (error) {
    return handleApiError(error, 'Intake status');
  }
}

function deriveNextAction(c: {
  consent_state: string;
  application_state: string;
  payment_state: string;
  membership_state: string;
}): { action: string; description: string; description_tl: string } {
  if (c.consent_state === 'withdrawn' || c.application_state === 'withdrawn') {
    return {
      action: 'withdrawn',
      description: 'Your application has been withdrawn.',
      description_tl: 'Ang iyong aplikasyon ay na-withdraw na.',
    };
  }

  if (c.membership_state === 'active_confirmed') {
    return {
      action: 'confirmed',
      description: 'Your Safe Card membership is active. Save your membership details and PRC contacts.',
      description_tl: 'Aktibo na ang iyong Safe Card membership. I-save ang iyong detalye at PRC contacts.',
    };
  }

  if (c.membership_state === 'declined') {
    return {
      action: 'declined',
      description: 'PRC was unable to approve your membership. Contact PRC Hotline 143 for details.',
      description_tl: 'Hindi naaprubahan ng PRC ang iyong membership. Tumawag sa PRC Hotline 143.',
    };
  }

  if (c.membership_state === 'pending_prc_confirmation') {
    return {
      action: 'waiting_prc',
      description: 'Your application has been sent to PRC. Please wait for their confirmation.',
      description_tl: 'Naipadala na sa PRC ang iyong aplikasyon. Maghintay ng kanilang kumpirmasyon.',
    };
  }

  if (c.payment_state === 'verified_by_official_source') {
    return {
      action: 'payment_verified',
      description: 'Payment verified. Your application is being prepared for PRC.',
      description_tl: 'Na-verify na ang bayad. Inihahanda ang iyong aplikasyon para sa PRC.',
    };
  }

  if (['official_handoff_opened', 'payer_marked_paid', 'verification_pending'].includes(c.payment_state)) {
    return {
      action: 'payment_pending',
      description: 'Payment is being processed. This does not mean your membership is active yet.',
      description_tl: 'Pinoproseso ang bayad. Hindi pa nangangahulugang aktibo ang iyong membership.',
    };
  }

  if (['submitted', 'resubmitted'].includes(c.application_state)) {
    return {
      action: 'submitted',
      description: 'Application submitted. Awaiting payment.',
      description_tl: 'Naisumite na ang aplikasyon. Naghihintay ng bayad.',
    };
  }

  if (c.application_state === 'correction_needed') {
    return {
      action: 'correction_needed',
      description: 'PRC needs corrections on your application. Please review and resubmit.',
      description_tl: 'Kailangan ng PRC ng pagbabago sa iyong aplikasyon. Suriin at muling isumite.',
    };
  }

  if (c.consent_state === 'agreed') {
    return {
      action: 'fill_application',
      description: 'You have agreed. Please fill in your application details.',
      description_tl: 'Pumayag ka na. Punan ang iyong detalye ng aplikasyon.',
    };
  }

  if (c.consent_state === 'expired_due_to_content_change') {
    return {
      action: 'review_updated_content',
      description: 'Important information has been updated. Please review the changes before continuing.',
      description_tl: 'May na-update na mahalagang impormasyon. Suriin ang pagbabago bago magpatuloy.',
    };
  }

  return {
    action: 'learn',
    description: 'Learn about Safe Card and decide if you want to apply.',
    description_tl: 'Alamin ang tungkol sa Safe Card at magdesisyon kung gusto mong mag-apply.',
  };
}
