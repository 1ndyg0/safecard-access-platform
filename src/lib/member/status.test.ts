import { describe, expect, it } from "vitest";
import { memberNextAction } from "./status";

const baseline = { application_state: "submitted", payment_state: "not_started", membership_state: "not_active" };

describe("memberNextAction", () => {
  it("never equates submission with activation", () => {
    expect(memberNextAction(baseline)).toContain("Payment remains a separate step");
  });

  it("tells a member with verified payment that approval is pending", () => {
    expect(memberNextAction({ ...baseline, payment_state: "verified_by_official_source" })).toContain("awaiting administrator approval");
  });

  it("prioritizes correction instructions", () => {
    expect(memberNextAction({ ...baseline, application_state: "correction_needed" })).toContain("correction");
  });

  it("shows the approved card message once approval and payment verification are both done", () => {
    expect(memberNextAction({ ...baseline, application_review_state: "approved", payment_state: "verified_by_official_source" })).toContain("Approved by SafeCard administration");
  });

  it("does not show approved while payment is unverified", () => {
    expect(memberNextAction({ ...baseline, application_review_state: "approved", payment_state: "verification_pending" })).toContain("Payment remains a separate step");
  });
});
