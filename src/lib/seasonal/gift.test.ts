import { describe, expect, it } from "vitest";
import { NAME_MAX, cardAltText, cardSubtitle, cardTitle, cleanName, giftMessage, giftUrl } from "./gift";

describe("gift card text", () => {
  it("cleans names without losing ordinary ones", () => {
    expect(cleanName("  Nanay  ")).toBe("Nanay");
    expect(cleanName("Ma.  Luisa\tSantos")).toBe("Ma. Luisa Santos");
    expect(cleanName("Peña Ñ")).toBe("Peña Ñ");
  });

  it("removes control characters and angle brackets", () => {
    expect(cleanName("Ian<script>alert(1)</script>")).toBe("Ianscriptalert(1)/script");
    expect(cleanName("A\u0000B\u202eC")).toBe("ABC");
    expect(cleanName("line\nbreak")).toBe("line break");
  });

  it("cuts at the limit by character, never inside an emoji", () => {
    const long = "A".repeat(40);
    expect(Array.from(cleanName(long))).toHaveLength(NAME_MAX);
    const emoji = "👨‍👩‍👧".repeat(30);
    for (const ch of Array.from(cleanName(emoji))) expect(ch).not.toMatch(/[\uD800-\uDBFF]$/);
  });

  it("handles empty names in both languages", () => {
    expect(cardTitle("", "en")).toBe("Merry Christmas");
    expect(cardTitle("", "fil")).toBe("Maligayang Pasko");
    expect(cardSubtitle("", "en")).toBe("With a year of protection");
    expect(cardTitle("Lola", "fil")).toBe("Maligayang Pasko, Lola");
    expect(cardSubtitle("Ian", "en")).toBe("From Ian, with a year of protection");
  });

  it("builds a message that ends with the link and keeps the choice with the recipient", () => {
    const url = giftUrl("https://safecard.example/");
    expect(url).toBe("https://safecard.example/apply?gift=1");
    const en = giftMessage("Nanay", "Ian", url, "en");
    expect(en.split("\n").at(-1)).toBe(url);
    expect(en).toMatch(/your choice/i);
    expect(giftMessage("Nanay", "Ian", url, "fil")).toMatch(/Ikaw ang magpapasya/);
  });

  it("never puts a name in the link", () => {
    expect(giftUrl("https://safecard.example")).not.toMatch(/Nanay|Ian/);
    expect(cardAltText("Nanay", "Ian", "en")).toContain("Nanay");
  });

  it("never promises that anything is free or guaranteed", () => {
    for (const locale of ["en", "fil"] as const) {
      expect(giftMessage("A", "B", "https://x.test", locale)).not.toMatch(/\bfree\b|\bguaranteed\b|libre|garantisado/i);
    }
  });
});
