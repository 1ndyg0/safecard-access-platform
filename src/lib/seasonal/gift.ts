import { CHRISTMAS } from "./christmas";

export type GiftLocale = "en" | "fil";

export const NAME_MAX = 24;

/**
 * Names are typed by a stranger and only ever drawn on a canvas or placed in a
 * message. Strip control characters and angle brackets, collapse spacing, and
 * cut at a fixed number of characters (not UTF-16 units, so nothing is split).
 */
export function cleanName(value: string): string {
  const stripped = value
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069<>]/g, "")
    .trim();
  return Array.from(stripped).slice(0, NAME_MAX).join("").trim();
}

export function giftUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}${CHRISTMAS.giftEntryPath}`;
}

export function cardTitle(to: string, locale: GiftLocale): string {
  const name = cleanName(to);
  if (locale === "fil") return name ? `Maligayang Pasko, ${name}` : "Maligayang Pasko";
  return name ? `Merry Christmas, ${name}` : "Merry Christmas";
}

export function cardSubtitle(from: string, locale: GiftLocale): string {
  const name = cleanName(from);
  if (locale === "fil") return name ? `Mula kay ${name}, may kasamang isang taon ng proteksyon` : "May kasamang isang taon ng proteksyon";
  return name ? `From ${name}, with a year of protection` : "With a year of protection";
}

/** The text that travels with the card when it is shared or copied. */
export function giftMessage(to: string, from: string, url: string, locale: GiftLocale): string {
  const name = cleanName(to);
  const sender = cleanName(from);
  if (locale === "fil") {
    return [
      name ? `Maligayang Pasko, ${name}!` : "Maligayang Pasko!",
      `Regalo ${sender ? `ni ${sender}` : "ko"} sa iyo ang isang taon ng SafeCard na proteksyon mula sa Philippine Red Cross.`,
      "Ikaw ang magpapasya kung sasali, at pribado ang sagot mo.",
      url,
    ].join("\n");
  }
  return [
    name ? `Merry Christmas, ${name}!` : "Merry Christmas!",
    `${sender ? `${sender} is` : "I am"} giving you a year of SafeCard protection from the Philippine Red Cross.`,
    "Joining is your choice, and your answer stays private.",
    url,
  ].join("\n");
}

export function cardAltText(to: string, from: string, locale: GiftLocale): string {
  return `${cardTitle(to, locale)}. ${cardSubtitle(from, locale)}.`;
}
