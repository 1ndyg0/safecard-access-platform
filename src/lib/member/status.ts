export function memberNextAction(record: {
  application_state: string;
  payment_state: string;
  prc_handoff_state: string;
  membership_state: string;
}) {
  if (record.membership_state === "active_confirmed") return "Membership confirmed by PRC.";
  if (record.membership_state === "declined") return "PRC did not confirm membership. Call Hotline 143 for assistance.";
  if (record.membership_state === "pending_prc_confirmation") return "Awaiting PRC confirmation.";
  if (record.prc_handoff_state === "exported" || record.prc_handoff_state === "acknowledged") return "Application sent to PRC for review.";
  if (record.payment_state === "verified_by_official_source") return "Payment verified; preparing the PRC handoff.";
  if (record.application_state === "correction_needed") return "A correction is required before the application can continue.";
  if (["submitted", "resubmitted"].includes(record.application_state)) return "Application received. Payment remains a separate step.";
  return "Continue or review the application.";
}
