import type { Locale } from "@/lib/public-content";

type Pair = Record<Locale, string>;
const p = (en: string, fil: string): Pair => ({ en, fil });

/**
 * Every word the Christmas campaign adds, in one place, in both languages.
 * Amounts and benefit names are NOT repeated here: the landing band reads
 * them from lib/education/content so there is a single source of truth.
 */
export const seasonalCopy = {
  footerTag: p("Merry Christmas from SafeCard", "Maligayang Pasko mula sa SafeCard"),
  footerTagApplyBy: p("Apply by December 10 for the holidays", "Mag-apply bago mag-Disyembre 10 para sa kapaskuhan"),

  badge: p("Merry Christmas · Maligayang Pasko", "Maligayang Pasko · Merry Christmas"),

  // Band on the landing page
  bandTitle: p("Merry Christmas from SafeCard", "Maligayang Pasko mula sa SafeCard"),
  bandBody: p(
    "Spend the holidays with peace of mind. SafeCard is ₱1,200 for one year. Payment review and Red Cross confirmation take a little time, so apply by December 10.",
    "Maging panatag ngayong kapaskuhan. ₱1,200 ang SafeCard para sa isang taon. May inaabot ang pagsusuri ng bayad at kumpirmasyon ng Red Cross, kaya mag-apply bago mag-Disyembre 10.",
  ),
  bandApply: p("Apply now", "Mag-apply na"),
  bandCovered: p("See the benefits", "Tingnan ang mga benepisyo"),
  bandArt: p(
    "Santa Claus flying over a snowy village in a sleigh pulled by reindeer",
    "Si Santa Claus na lumilipad sa ibabaw ng nayong may niyebe sakay ng sleigh na hinihila ng mga reindeer",
  ),

  // Member card
  memberGreetingTitle: p("Merry Christmas!", "Maligayang Pasko!"),
  memberGreetingBody: p("Thank you for being part of SafeCard. Keep your card number handy and call 143 in an emergency.", "Salamat sa pagiging bahagi ng SafeCard. Itabi ang card number mo at tumawag sa 143 kapag may emergency."),
} as const;
