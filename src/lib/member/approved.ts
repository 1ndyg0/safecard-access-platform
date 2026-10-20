/**
 * An application is "administrator-approved" when staff approved the
 * application and the payment proof was verified. For this pilot the
 * approving super-admin decision stands on its own: no PRC handoff or
 * PRC confirmation is required for the member to see an approved card.
 *
 * This is deliberately NOT PRC-confirmed membership. The card says so.
 */
export function isAdministratorApproved(record: {
  application_review_state?: string | null;
  payment_state?: string | null;
  membership_state?: string | null;
}): boolean {
  if (record.membership_state === 'declined') return false;
  return record.application_review_state === 'approved'
    && record.payment_state === 'verified_by_official_source';
}

/** 09254636315 -> 0925•••6315. Enough for the member to recognise it. */
export function maskMobile(mobile: string | null | undefined): string {
  if (!mobile) return '';
  const digits = mobile.trim();
  if (digits.length < 7) return '•'.repeat(digits.length);
  return `${digits.slice(0, 4)}${'•'.repeat(digits.length - 8)}${digits.slice(-4)}`;
}
