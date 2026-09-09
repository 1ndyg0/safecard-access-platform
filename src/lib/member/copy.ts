/**
 * Member-facing copy, Filipino and English.
 *
 * Every string an applicant can see lives here, including loading,
 * empty, retry and error text. Those are the states people actually hit
 * on a slow connection, and leaving them in English while the rest of
 * the page is Filipino is how a bilingual product quietly stops being
 * bilingual.
 *
 * Filipino is the default. Reviewer-written reasons are NOT translated:
 * they are shown exactly as the reviewer wrote them, because a machine
 * rewording of "your birth date does not match your document" can change
 * what the applicant is being asked to do.
 */

export type Locale = 'fil' | 'en';

type Copy = Record<Locale, string>;

function pick(copy: Copy, locale: Locale): string {
  return copy[locale];
}

export const memberCopy = {
  statusTitle: { fil: 'Katayuan ng aplikasyon', en: 'Application status' },
  reference: { fil: 'Reference number', en: 'Reference number' },
  loading: { fil: 'Kinukuha ang protektadong katayuan…', en: 'Loading protected status…' },
  loadError: {
    fil: 'Hindi ma-load ang katayuan. Pakisubukan muli.',
    en: 'We could not load your status. Please try again.',
  },
  retry: { fil: 'Subukan muli', en: 'Try again' },
  empty: {
    fil: 'Wala pang aplikasyon na nakatali sa reference na ito.',
    en: 'There is no application linked to this reference yet.',
  },
  lastUpdated: { fil: 'Huling na-update', en: 'Last updated' },
  hotlineHelp: {
    fil: 'Para sa opisyal na tanong, tumawag sa Hotline 143.',
    en: 'For official questions, call Hotline 143.',
  },
  callHotline: { fil: 'Tumawag sa Hotline 143', en: 'Call Hotline 143' },

  // Independent state labels.
  labelApplication: { fil: 'Aplikasyon', en: 'Application' },
  labelReview: { fil: 'Pagsusuri ng aplikasyon', en: 'Application review' },
  labelPayment: { fil: 'Bayad', en: 'Payment' },
  labelHandoff: { fil: 'Pagpapadala sa PRC', en: 'PRC handoff' },
  labelMembership: { fil: 'Membership', en: 'Membership' },

  separateStates: {
    fil: 'Magkahiwalay ang mga hakbang na ito. Ang naaprubahang aplikasyon ay hindi bayad, at ang bayad ay hindi membership. Ang PRC lamang ang makakapagsimula ng membership.',
    en: 'These steps are separate. An approved application is not a payment, and a payment is not membership. Only PRC can activate membership.',
  },

  // Review outcomes.
  reviewPending: { fil: 'Naghihintay ng pagsusuri', en: 'Awaiting review' },
  reviewApproved: { fil: 'Naaprubahan ang aplikasyon', en: 'Application approved' },
  reviewResubmission: { fil: 'Kailangan ng pagwawasto', en: 'Correction needed' },
  reviewRejected: { fil: 'Hindi naaprubahan', en: 'Not approved' },

  approvedNotMembership: {
    fil: 'Naaprubahan ang iyong aplikasyon. Hindi pa ito membership — hihintayin pa ang kumpirmasyon ng PRC.',
    en: 'Your application was approved. This is not membership yet — PRC confirmation is still required.',
  },
  reasonFromReviewer: { fil: 'Paliwanag mula sa nagsuri', en: 'Reason from the reviewer' },
  rejectedGuidance: {
    fil: 'Kung sa tingin mo ay may mali, tumawag sa Hotline 143 para sa opisyal na tulong.',
    en: 'If you believe this is wrong, call Hotline 143 for official assistance.',
  },

  // Correction form.
  correctionTitle: { fil: 'Iwasto ang aplikasyon', en: 'Correct your application' },
  correctionIntro: {
    fil: 'Pakisuri ang bawat field. Kahit hindi mo binago, kailangan mong basahin ang lahat bago isumite muli.',
    en: 'Please check every field. Even the ones you do not change, you must read before submitting again.',
  },
  reviewedAllFields: {
    fil: 'Nabasa ko ang lahat ng field at tama ang mga ito.',
    en: 'I have read every field and they are correct.',
  },
  submitCorrection: { fil: 'Isumite ang pagwawasto', en: 'Submit correction' },
  submitting: { fil: 'Isinusumite…', en: 'Submitting…' },
  correctionSubmitted: {
    fil: 'Naisumite ang pagwawasto. Isinumite ito para sa panibagong pagsusuri. Hindi nagbago ang bayad, pagpapadala sa PRC, at membership.',
    en: 'Your correction was submitted for another review. Your payment, PRC handoff and membership are unchanged.',
  },
  correctionNotRequested: {
    fil: 'Walang hinihinging pagwawasto sa ngayon.',
    en: 'No correction has been requested right now.',
  },
  correctionAlreadySubmitted: {
    fil: 'Naisumite mo na ang pagwawasto. Naghihintay ito ng pagsusuri.',
    en: 'You have already submitted this correction. It is waiting for review.',
  },
  consentWithdrawn: {
    fil: 'Nabawi ang iyong pahintulot, kaya hindi maaaring magsumite ng pagwawasto. Tumawag sa Hotline 143.',
    en: 'Your consent was withdrawn, so a correction cannot be submitted. Call Hotline 143.',
  },
  consentExpired: {
    fil: 'Nag-expire ang iyong pahintulot dahil nagbago ang nilalaman. Kailangan ng bagong pahintulot.',
    en: 'Your consent expired because the content changed. New consent is required.',
  },
  consentRenewalRequired: {
    fil: 'Nagbago ang mahalagang bahagi ng consent o privacy notice. Basahin at pumayag muli bago magsumite.',
    en: 'The consent or privacy notice changed materially. Please read and agree again before submitting.',
  },
  whatChanged: { fil: 'Ano ang nagbago', en: 'What changed' },

  // Payment replacement.
  paymentReplacementTitle: {
    fil: 'Kailangan ng bagong patunay ng bayad',
    en: 'New payment proof required',
  },
  paymentReplacementIntro: {
    fil: 'Hiniling ng nagsuri na palitan ang patunay ng bayad.',
    en: 'The reviewer asked for the payment proof to be replaced.',
  },

  // Validation.
  required: { fil: 'Kailangan ang field na ito.', en: 'This field is required.' },
  invalidMobile: {
    fil: 'Ang mobile number ay dapat magsimula sa 09 o +639.',
    en: 'Mobile number must start with 09 or +639.',
  },
  invalidDate: { fil: 'Gamitin ang YYYY-MM-DD.', en: 'Use YYYY-MM-DD.' },
  invalidZip: { fil: 'Apat na numero ang ZIP code.', en: 'ZIP code is four digits.' },
  mustConfirm: {
    fil: 'Lagyan ng check ang kahon bago magsumite.',
    en: 'Tick the box before submitting.',
  },

  // Session.
  sessionExpired: {
    fil: 'Natapos ang iyong session. Mag-log in muli.',
    en: 'Your session expired. Please sign in again.',
  },
  signOut: { fil: 'Mag-log out', en: 'Sign out' },
  clearDevice: { fil: 'Burahin sa hiniram na device', en: 'Clear this shared device' },
} as const;

export type MemberCopyKey = keyof typeof memberCopy;

export function t(key: MemberCopyKey, locale: Locale): string {
  return pick(memberCopy[key], locale);
}

/** Human label for a review state, in the reader's language. */
export function reviewStateLabel(state: string, locale: Locale): string {
  switch (state) {
    case 'approved':
      return t('reviewApproved', locale);
    case 'resubmission_requested':
      return t('reviewResubmission', locale);
    case 'rejected':
      return t('reviewRejected', locale);
    case 'pending':
    default:
      return t('reviewPending', locale);
  }
}

/** Message for a blocked correction, keyed by the server's reason. */
export function correctionBlockMessage(reason: string | undefined, locale: Locale): string {
  switch (reason) {
    case 'consent_withdrawn':
      return t('consentWithdrawn', locale);
    case 'consent_expired':
      return t('consentExpired', locale);
    case 'consent_renewal_required':
      return t('consentRenewalRequired', locale);
    case 'already_resubmitted':
      return t('correctionAlreadySubmitted', locale);
    case 'not_requested':
    default:
      return t('correctionNotRequested', locale);
  }
}

/** Field labels for the correction form. */
export const fieldLabels: Record<string, Copy> = {
  first_name: { fil: 'Pangalan', en: 'First name' },
  middle_name: { fil: 'Gitnang pangalan', en: 'Middle name' },
  last_name: { fil: 'Apelyido', en: 'Last name' },
  date_of_birth: { fil: 'Petsa ng kapanganakan', en: 'Date of birth' },
  sex: { fil: 'Kasarian', en: 'Sex' },
  civil_status: { fil: 'Katayuang sibil', en: 'Civil status' },
  address_line1: { fil: 'Address linya 1', en: 'Address line 1' },
  address_line2: { fil: 'Address linya 2', en: 'Address line 2' },
  city: { fil: 'Lungsod', en: 'City' },
  province: { fil: 'Probinsya', en: 'Province' },
  zip_code: { fil: 'ZIP code', en: 'ZIP code' },
  mobile_number: { fil: 'Mobile number', en: 'Mobile number' },
  email: { fil: 'Email', en: 'Email' },
};

export function fieldLabel(field: string, locale: Locale): string {
  return fieldLabels[field] ? pick(fieldLabels[field], locale) : field;
}
