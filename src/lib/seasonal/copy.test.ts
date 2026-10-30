import { describe, expect, it } from "vitest";
import { CHRISTMAS } from "./christmas";
import { seasonalCopy } from "./copy";

const everyString = (value: unknown): string[] =>
  typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(everyString) : [];

describe("Christmas copy", () => {
  it("has both languages for every line", () => {
    for (const [key, line] of Object.entries(seasonalCopy)) {
      expect(line.en.trim(), `${key} en`).not.toBe("");
      expect(line.fil.trim(), `${key} fil`).not.toBe("");
    }
  });

  it("states the apply-by date in the strip, the band and the footer", () => {
    for (const locale of ["en", "fil"] as const) {
      expect(seasonalCopy.strip[locale]).toContain(CHRISTMAS.applyBy[locale]);
      expect(seasonalCopy.bandBody[locale]).toContain(CHRISTMAS.applyBy[locale]);
      expect(seasonalCopy.footerTagApplyBy[locale]).toContain(CHRISTMAS.applyBy[locale]);
    }
  });

  it("does not mention gifting anywhere", () => {
    const text = everyString(seasonalCopy).join(" ");
    expect(text).not.toMatch(/\bgift|regalo|iregalo|magregalo/i);
  });
});
