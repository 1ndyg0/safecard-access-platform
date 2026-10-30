import { describe, expect, it } from "vitest";
import { CHRISTMAS, isSeasonActive, seasonBootScript, seasonMode, type SeasonMode } from "./christmas";

const at = (iso: string) => Date.parse(iso);

describe("Christmas season window", () => {
  it("is off before the start and on at the first instant", () => {
    expect(isSeasonActive(at("2026-11-14T23:59:59+08:00"))).toBe(false);
    expect(isSeasonActive(at(CHRISTMAS.startsAt))).toBe(true);
  });

  it("covers Christmas Day and New Year's Eve in Philippine time", () => {
    expect(isSeasonActive(at("2026-12-25T12:00:00+08:00"))).toBe(true);
    expect(isSeasonActive(at("2026-12-31T23:59:59+08:00"))).toBe(true);
  });

  it("ends on its own at the end date, with no deploy", () => {
    expect(isSeasonActive(at(CHRISTMAS.endsAt))).toBe(false);
    expect(isSeasonActive(at("2027-02-01T00:00:00+08:00"))).toBe(false);
  });

  it("lets the kill switch beat every other setting", () => {
    expect(isSeasonActive(at("2026-12-25T12:00:00+08:00"), "off")).toBe(false);
    expect(isSeasonActive(at("2026-12-25T12:00:00+08:00"), "off", "christmas")).toBe(false);
    expect(isSeasonActive(at("2026-10-30T12:00:00+08:00"), "off", "christmas")).toBe(false);
  });

  it("lets a reviewer preview it before launch, and turn it off during the season", () => {
    expect(isSeasonActive(at("2026-10-30T12:00:00+08:00"), "auto", "christmas")).toBe(true);
    expect(isSeasonActive(at("2026-12-25T12:00:00+08:00"), "auto", "off")).toBe(false);
  });

  it("forces the season on when asked, for in-season testing", () => {
    expect(isSeasonActive(at("2026-10-30T12:00:00+08:00"), "always")).toBe(true);
  });

  it("ignores unknown settings", () => {
    expect(seasonMode(undefined)).toBe("auto");
    expect(seasonMode("yes")).toBe("auto");
    expect(seasonMode("off")).toBe("off");
    expect(seasonMode("always")).toBe("always");
  });
});

/** Runs the real head script against a stand-in document and returns the attribute it set. */
function runBootScript(mode: SeasonMode, now: number, search = ""): string | null {
  let attribute: string | null = null;
  const document = { documentElement: { setAttribute: (name: string, value: string) => { if (name === "data-season") attribute = value; } } };
  new Function("document", "location", "Date", `return ${seasonBootScript(mode).replace(/;$/, "")}`)(
    document,
    { search },
    { now: () => now },
  );
  return attribute;
}

describe("head script", () => {
  const cases: Array<[string, SeasonMode, string, string]> = [
    ["before the window", "auto", "2026-10-30T12:00:00+08:00", ""],
    ["inside the window", "auto", "2026-12-01T12:00:00+08:00", ""],
    ["after the window", "auto", "2027-01-01T00:00:00+08:00", ""],
    ["preview before launch", "auto", "2026-10-30T12:00:00+08:00", "?season=christmas"],
    ["off during the season", "auto", "2026-12-01T12:00:00+08:00", "?season=off"],
    ["kill switch with preview", "off", "2026-12-01T12:00:00+08:00", "?season=christmas"],
    ["forced on", "always", "2026-10-30T12:00:00+08:00", ""],
    ["forced on, preview off", "always", "2026-10-30T12:00:00+08:00", "?season=off"],
    ["unrelated query", "auto", "2026-12-01T12:00:00+08:00", "?ref=abc&season=winter"],
  ];
  for (const [name, mode, iso, search] of cases) {
    it(`agrees with isSeasonActive: ${name}`, () => {
      const preview = new URLSearchParams(search).get("season");
      const expected = isSeasonActive(at(iso), mode, preview);
      expect(runBootScript(mode, at(iso), search)).toBe(expected ? "christmas" : null);
    });
  }

  it("never throws when the page has no location", () => {
    expect(() => new Function("document", "location", "Date", `return ${seasonBootScript("auto").replace(/;$/, "")}`)({}, undefined, Date)).not.toThrow();
  });
});
