import { describe, expect, it } from "vitest";
import { formatCalendarDate, formatDate, formatMoney, humanize } from "./format";

describe("admin display helpers", () => {
  it("shows calendar dates without a time-zone shift", () => {
    expect(formatCalendarDate("2001-03-05")).toMatch(/^(5 Mar 2001|Mar 5, 2001)$/);
    expect(formatCalendarDate(null)).toBe("—");
    expect(formatCalendarDate("garbage")).toBe("—");
  });

  it("shows timestamps in Philippine time", () => {
    // 2026-09-30 17:00 UTC is already 1 October in Manila.
    expect(formatDate("2026-09-30T17:00:00.000Z")).toMatch(/^(1 Oct 2026|Oct 1, 2026)$/);
    expect(formatDate("not a date")).toBe("—");
  });

  it("formats pesos and tolerates missing amounts", () => {
    expect(formatMoney(1200)).toContain("1,200.00");
    expect(formatMoney("1200.5")).toContain("1,200.50");
    expect(formatMoney(null)).toBe("—");
  });

  it("humanizes workflow labels", () => {
    expect(humanize("awaiting_review")).toBe("Awaiting review");
  });
});
