import { describe, expect, it } from "vitest";
import { accident, coverage, downloads, faq, heroFacts, joinNote, library, sectionIndex, whatYouGet } from "./content";
import { GUIDE_SECTION_IDS, guideSections, type GuideBlock } from "./guide";
import { DOCUMENTS } from "@/lib/documents/registry";

/** Same rule as the rest of the public copy: it must read like a live product. */
const PILOT_WORDING = /pilot|school-project|for validation|working baseline|illustrative|synthetic|demo\b/i;

type Leaf = { path: string; value: string };

/** Every string in a content tree, with the path that reaches it. */
function leaves(value: unknown, path = ""): Leaf[] {
  if (typeof value === "string") return [{ path, value }];
  if (Array.isArray(value)) return value.flatMap((item, index) => leaves(item, `${path}[${index}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  return [];
}

/** Every `{ en, fil }` pair in a content tree. */
function localizedPairs(value: unknown, path = ""): { path: string; en: string; fil: string }[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => localizedPairs(item, `${path}[${index}]`));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.en === "string" && typeof record.fil === "string") return [{ path, en: record.en, fil: record.fil }];
    return Object.entries(record).flatMap(([key, child]) => localizedPairs(child, path ? `${path}.${key}` : key));
  }
  return [];
}

const education = { sectionIndex, heroFacts, whatYouGet, coverage, accident, joinNote, faq, downloads, library };

describe("education content", () => {
  it("has a non-empty English and Filipino text for every entry", () => {
    const pairs = localizedPairs(education);
    expect(pairs.length).toBeGreaterThan(100);
    for (const pair of pairs) {
      expect(pair.en.trim(), `${pair.path} (en)`).not.toBe("");
      expect(pair.fil.trim(), `${pair.path} (fil)`).not.toBe("");
    }
  });

  it("never leaves a bare string where a translated pair is expected", () => {
    // Plain strings are allowed only for ids, asset paths, anchors and icon names.
    const allowed = /(\.id|\.src|\.landing|\.member|\.name|\.kind|\.visual\.|\.thumbnail\.|\.items\.[a-z-]+\.description)/;
    const pairedPaths = new Set(localizedPairs(education).flatMap((pair) => [`${pair.path}.en`, `${pair.path}.fil`]));
    for (const leaf of leaves(education)) {
      if (pairedPaths.has(leaf.path)) continue;
      expect(leaf.path, `untranslated string: ${leaf.value}`).toMatch(allowed);
    }
  });

  it("has no pilot, demo or validation wording in either language", () => {
    for (const leaf of leaves(education)) expect(leaf.value, leaf.path).not.toMatch(PILOT_WORDING);
    for (const leaf of leaves(guideSections)) expect(leaf.value, leaf.path).not.toMatch(PILOT_WORDING);
  });

  it("states the published amounts, limits and deadlines exactly", () => {
    const amounts = whatYouGet.insurance.tiles.map((tile) => tile.amount.en);
    expect(amounts).toEqual(["₱300,000", "₱300,000", "₱10,000", "₱5,000", "₱200 a day"]);
    expect(whatYouGet.insurance.tiles[4].text.en).toContain("60 days");
    expect(whatYouGet.insurance.tiles[4].note?.en).toContain("24 hours");
    expect(whatYouGet.insurance.tiles[2].note?.en).toBe("Per accident");

    const waits = coverage.wait.cards.map((card) => card.figure.en);
    expect(waits).toEqual(["Day 1", "30 days", "6 months"]);

    const [call, notify, submit, decide] = accident.steps;
    expect(call.deadline).toBe(false);
    expect(notify.when.en).toBe("By day 30");
    expect(submit.when.en).toBe("By day 60");
    expect(decide.deadline).toBe(false);
    expect(notify.deadline && submit.deadline).toBe(true);

    expect(heroFacts.map((fact) => fact.en)).toEqual(["₱1,200 a year", "Ages 3 to 85", "Valid for 1 year", "Cannot be transferred"]);
  });

  it("keeps the blood tile precise about what is included", () => {
    expect(whatYouGet.services.tiles[1].text.en).toMatch(/apheresis/i);
  });

  it("carries no footnotes under the benefits or the coverage lists", () => {
    // Removed on purpose after review: the notes read as negative. The legal
    // wording stays in the member guide and the notice, which are tested below.
    expect(whatYouGet.insurance).not.toHaveProperty("footnote");
    expect(whatYouGet.services).not.toHaveProperty("footnote");
    expect(coverage).not.toHaveProperty("note");
  });

  it("never promises that anything is free or guaranteed", () => {
    for (const leaf of leaves(education)) {
      if (leaf.path.endsWith(".fil")) continue;
      expect(leaf.value, leaf.path).not.toMatch(/\bfree\b|\bguaranteed\b|\bimmediately\b/i);
    }
  });

  it("gives every FAQ item an id, a question and an answer, with unique ids", () => {
    const ids = faq.items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(faq.items).toHaveLength(13);
    for (const item of faq.items) expect(item.answer.length, item.id).toBeGreaterThan(0);
  });

  it("points FAQ links only at sections that exist", () => {
    const landingIds = new Set(sectionIndex.map((entry) => `#${entry.id}`));
    for (const item of faq.items) {
      if (!item.more) continue;
      expect(landingIds.has(item.more.landing), `${item.id} landing link`).toBe(true);
      const [, hash] = item.more.member.split("#");
      expect(item.more.member.startsWith("/member/library/guide#"), item.id).toBe(true);
      expect(GUIDE_SECTION_IDS, `${item.id} guide link`).toContain(hash);
    }
  });

  it("keeps the ids the site header and footer link to", () => {
    const ids = sectionIndex.map((entry) => entry.id);
    expect(ids).toContain("benefits");
    expect(ids).toContain("process");
    expect(ids).toEqual(["benefits", "covered", "accident", "process", "faq", "downloads"]);
  });

  it("describes every registered document and no other", () => {
    const described = Object.keys(downloads.items).sort();
    expect(described).toEqual(DOCUMENTS.map((document) => document.slug).sort());
  });

  it("lists each document-checklist item once", () => {
    for (const list of [accident.documents.hospital.items, accident.documents.death.items]) {
      const english = list.map((item) => item.en);
      expect(new Set(english).size).toBe(english.length);
    }
  });
});

describe("member guide content", () => {
  const section = (id: string) => guideSections.find((entry) => entry.id === id)!;

  it("follows the numbering of the printed guide", () => {
    const numbers = guideSections.map((entry) => entry.number).filter(Boolean);
    expect(numbers).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"]);
  });

  it("has unique ids and page references that run forward inside the 59-page PDF", () => {
    expect(new Set(GUIDE_SECTION_IDS).size).toBe(GUIDE_SECTION_IDS.length);
    const guide = DOCUMENTS.find((document) => document.slug === "member-guide")!;
    let previous = 0;
    for (const entry of guideSections) {
      expect(entry.page, entry.id).toBeGreaterThan(previous);
      expect(entry.page, entry.id).toBeLessThanOrEqual(guide.pageCount);
      previous = entry.page;
    }
  });

  it("builds every table with the same number of cells in each row", () => {
    for (const entry of guideSections) {
      for (const block of entry.blocks) {
        if (block.type !== "table") continue;
        for (const row of block.rows) expect(row.length, `${entry.id}: ${row[0]}`).toBe(block.head.length);
      }
    }
  });

  it("carries the published benefit limits", () => {
    const table = section("benefits").blocks.find((block): block is Extract<GuideBlock, { type: "table" }> => block.type === "table")!;
    const limits = Object.fromEntries(table.rows.map((row) => [row[0], row[1]]));
    expect(limits["Accidental Death, Disablement & Dismemberment"]).toBe("₱300,000");
    expect(limits["Unprovoked Murder & Assault"]).toBe("₱300,000");
    expect(limits["Accidental Medical Reimbursement"]).toBe("₱10,000");
    expect(limits["Burial Assistance — Accident"]).toBe("₱5,000");
    expect(limits["Hospital Daily Allowance"]).toBe("₱200/day, up to 60 days");
  });

  it("keeps the permanent partial disablement table complete", () => {
    const table = section("exclusions").blocks.find(
      (block): block is Extract<GuideBlock, { type: "table" }> => block.type === "table" && block.head[0] === "Injury",
    )!;
    expect(table.rows).toHaveLength(29);
    const percentages = table.rows.map((row) => row[1]);
    for (const value of percentages) expect(value).toMatch(/^\d+(\.\d+)?%$/);
    // The sequence printed in the PDF, page 19 to 21, in order.
    expect(percentages.map((value) => parseFloat(value))).toEqual([
      100, 100, 100, 100, 100, 100, 75, 25, 100, 50, 70, 50, 40, 30, 30, 15, 20, 10, 10, 7.5, 5, 7.5, 7, 2, 15, 5, 3, 10, 7.5,
    ]);
    expect(Math.max(...percentages.map((value) => parseFloat(value)))).toBe(100);
  });

  it("states the claim deadlines the landing page repeats", () => {
    const steps = section("claims").blocks.find((block): block is Extract<GuideBlock, { type: "steps" }> => block.type === "steps")!;
    expect(steps.items[0].text).toContain("within 30 days");
    expect(steps.items[1].text).toContain("within 60 days");
  });

  it("uses the corrected Safe Card telephone number and claims address", () => {
    const text = leaves(guideSections).map((leaf) => leaf.value).join("\n");
    expect(text).toContain("(+63 2) 8790-2300 local 184");
    expect(text).not.toMatch(/(?<!8)790-2300/);
    expect(text).not.toContain("membershipbclaims");
  });

  it("keeps the insurer's role in the notice and the legal section", () => {
    expect(JSON.stringify(section("notice"))).toContain("is NOT an insurer");
    expect(JSON.stringify(section("legal"))).toContain("Policy controls");
  });
});
