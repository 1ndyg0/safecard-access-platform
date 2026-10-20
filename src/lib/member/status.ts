import { isAdministratorApproved } from "./approved";

export function memberNextAction(record: {
  application_review_state?: string | null;
  application_state: string;
  payment_state: string;
  membership_state: string;
}) {
  if (record.membership_state === "declined") return "Your application was not approved. Call Hotline 143 for assistance.";
  if (isAdministratorApproved(record)) return "Approved by SafeCard administration. Your electronic SafeCard is ready.";
  if (record.payment_state === "verified_by_official_source") return "Payment verified; awaiting administrator approval.";
  if (record.application_state === "correction_needed") return "A correction is required before the application can continue.";
  if (["submitted", "resubmitted"].includes(record.application_state)) return "Application received. Payment remains a separate step.";
  return "Continue or review the application.";
}
