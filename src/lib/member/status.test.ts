import { describe, expect, it } from "vitest";
import { memberNextAction } from "./status";

const baseline = { application_state: "submitted", payment_state: "not_started", prc_handoff_state: "not_ready", membership_state: "not_active" };

describe("memberNextAction", () => {
  it("never equates submission with activation", () => {
    expect(memberNextAction(baseline)).toContain("Payment remains a separate step");
  });

  it("reports active only after PRC confirmation", () => {
    expect(memberNextAction({ ...baseline, membership_state: "active_confirmed" })).toBe("Membership confirmed by PRC.");
  });

  it("prioritizes correction instructions", () => {
    expect(memberNextAction({ ...baseline, application_state: "correction_needed" })).toContain("correction");
  });
});
