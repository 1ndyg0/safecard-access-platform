/**
 * Correction eligibility and consent revalidation.
 *
 * A correction is a new submission, so it must clear the same consent
 * bar the original did. Two ways that bar can have moved since:
 *
 *   1. The applicant withdrew consent, or it expired.
 *   2. The published consent or privacy notice changed materially.
 *
 * In both cases the correct answer is to stop and ask again, not to
 * accept the resubmission under a consent the person never gave. The
 * second case is the easy one to get wrong: the applicant is mid-task,
 * the form is already on screen, and silently reusing the old consent
 * would feel smoother. It would also mean processing their data under
 * terms they never saw.
 */

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/** UI locales are fil/en; content_versions stores tl/en/ceb. */
export type UiLocale = 'fil' | 'en';
export function contentLocale(locale: UiLocale): 'tl' | 'en' {
  return locale === 'fil' ? 'tl' : 'en';
}

export type CorrectionBlockReason =
  | 'not_requested'
  | 'consent_withdrawn'
  | 'consent_expired'
  | 'consent_renewal_required'
  | 'already_resubmitted';

export interface CorrectionEligibility {
  allowed: boolean;
  reason?: CorrectionBlockReason;
  /** Present when consent must be given again before resubmitting. */
  renewedConsent?: {
    consentVersionId: string;
    privacyNoticeVersionId: string;
    changeSummary: string | null;
  };
}

/**
 * Latest published version of a content type, in the requested locale.
 * Falls back to any locale so a missing translation does not present as
 * "no published content".
 */
async function latestPublished(
  admin: SupabaseClient,
  contentType: string,
  locale: 'tl' | 'en',
) {
  const { data } = await admin
    .from('content_versions')
    .select('id,version,is_material_change,change_summary,locale,published_at')
    .eq('content_type', contentType)
    .eq('approval_status', 'published')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(20);

  const rows = data ?? [];
  return rows.find((row) => row.locale === locale) ?? rows[0] ?? null;
}

/**
 * Decide whether this case may submit a correction right now.
 *
 * `caseRecord` is read by the caller so this function does no implicit
 * fetching of the case — the member routes must always scope by session.
 */
export async function evaluateCorrectionEligibility(
  admin: SupabaseClient,
  caseRecord: {
    id: string;
    consent_state: string;
    application_state: string;
    application_review_state: string;
    consent_content_version_id: string | null;
    privacy_notice_version_id: string | null;
  },
  locale: UiLocale,
): Promise<CorrectionEligibility> {
  if (caseRecord.application_review_state !== 'resubmission_requested') {
    return { allowed: false, reason: 'not_requested' };
  }
  if (caseRecord.application_state === 'resubmitted') {
    // The correction already landed; a second submission would create a
    // duplicate version for the same request.
    return { allowed: false, reason: 'already_resubmitted' };
  }
  if (caseRecord.consent_state === 'withdrawn') {
    return { allowed: false, reason: 'consent_withdrawn' };
  }
  if (caseRecord.consent_state === 'expired_due_to_content_change') {
    return { allowed: false, reason: 'consent_expired' };
  }

  const wanted = contentLocale(locale);
  const [consentVersion, privacyVersion] = await Promise.all([
    latestPublished(admin, 'consent_text', wanted),
    latestPublished(admin, 'privacy_notice', wanted),
  ]);

  const consentMoved =
    consentVersion && consentVersion.id !== caseRecord.consent_content_version_id;
  const privacyMoved =
    privacyVersion && privacyVersion.id !== caseRecord.privacy_notice_version_id;

  // Only a *material* change forces renewal. An editorial fix to a typo
  // should not throw an applicant out of a correction they are halfway
  // through; a change to what they are agreeing to must.
  const materiallyChanged =
    (consentMoved && consentVersion?.is_material_change === true) ||
    (privacyMoved && privacyVersion?.is_material_change === true);

  if (materiallyChanged) {
    return {
      allowed: false,
      reason: 'consent_renewal_required',
      renewedConsent: {
        consentVersionId: consentVersion?.id as string,
        privacyNoticeVersionId: privacyVersion?.id as string,
        changeSummary:
          consentVersion?.change_summary ?? privacyVersion?.change_summary ?? null,
      },
    };
  }

  return { allowed: true };
}

export {
  CORRECTABLE_FIELDS,
  CORRECTABLE_SELECT,
  type CorrectableField,
} from './correction-fields';
