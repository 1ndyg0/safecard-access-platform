/**
 * POST /api/intake/comprehension
 *
 * Comprehension check before application submission.
 * The recipient must answer questions demonstrating they understand:
 * - What Safe Card covers (and doesn't)
 * - That payment ≠ membership activation
 * - Their right to withdraw consent
 * - How to contact PRC for claims
 *
 * The comprehension check is pass/fail. A failed check does NOT
 * block submission but is recorded for transparency.
 */

import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { writeAuditEvent } from '@/lib/audit';
import { success, unauthorized, notFound, handleApiError } from '@/lib/api/response';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { z } from 'zod';

const comprehensionSchema = z.object({
  case_id: z.string().uuid(),
  answers: z.object({
    /** "What does Safe Card cover?" — must select correct option */
    coverage_understanding: z.boolean(),
    /** "Does paying guarantee activation?" — must answer false */
    payment_not_activation: z.boolean(),
    /** "Can you withdraw consent?" — must answer true */
    can_withdraw_consent: z.boolean(),
    /** "Who do you contact for claims?" — must select PRC */
    claims_contact_correct: z.boolean(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'intake.comprehension');
    const auth = await getAuthContext();
    if (!auth) return unauthorized();

    const body = await request.json();
    const parsed = comprehensionSchema.parse(body);

    const admin = getSupabaseAdminClient();

    // Verify case ownership
    const { data: caseData } = await admin
      .from('recipient_cases')
      .select('id, auth_user_id, campaign_id, application_state')
      .eq('id', parsed.case_id)
      .single();

    if (!caseData) return notFound('Case not found');

    if (caseData.auth_user_id !== auth.userId) {
      return unauthorized('You can only complete comprehension for your own case');
    }

    // Calculate result
    const { answers } = parsed;
    // Each boolean means the recipient selected the correct statement.
    const passed =
      answers.coverage_understanding &&
      answers.payment_not_activation &&
      answers.can_withdraw_consent &&
      answers.claims_contact_correct;

    const score = [
      answers.coverage_understanding,
      answers.payment_not_activation,
      answers.can_withdraw_consent,
      answers.claims_contact_correct,
    ].filter(Boolean).length;

    // Store the result on the application submission (if one exists)
    // or just record it for when submission happens
    await admin
      .from('recipient_cases')
      .update({
        comprehension_passed: passed,
        comprehension_score: score,
        comprehension_checked_at: new Date().toISOString(),
      })
      .eq('id', parsed.case_id);

    await writeAuditEvent({
      event_type: 'comprehension_check',
      actor_id: auth.userId,
      actor_type: 'user',
      action: `Comprehension check: ${passed ? 'passed' : 'failed'} (${score}/4)`,
      campaign_id: caseData.campaign_id,
      target_type: 'recipient_case',
      target_id: parsed.case_id,
      details: { passed, score },
    });

    return success({
      passed,
      score,
      total: 4,
      feedback: passed
        ? {
            tl: 'Salamat! Naintindihan mo ang mga mahahalagang punto.',
            en: 'Thank you! You understand the key points.',
          }
        : {
            tl: 'Mangyaring suriin muli ang mga impormasyon. Maaari kang magtanong sa iyong sponsor o sa support.',
            en: 'Please review the information again. You can ask your sponsor or contact support.',
          },
    });
  } catch (error) {
    return handleApiError(error, 'Comprehension check');
  }
}
