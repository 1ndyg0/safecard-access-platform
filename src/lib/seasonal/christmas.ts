/**
 * Christmas 2026 campaign: the one place that decides when it is on.
 *
 * Everything seasonal (banner, decorations, /gift, the card maker, the gift
 * welcome) is hidden by CSS until the page carries `data-season="christmas"`
 * on <html>. A tiny script in the document head sets that attribute before the
 * first paint, so there is no flash, the statically built pages do not go
 * stale, and the campaign ends by itself on the end date without a deploy.
 *
 * Switches, strongest first:
 *   NEXT_PUBLIC_SEASONAL_CAMPAIGN=off      kills it everywhere, including previews
 *   ?season=off | ?season=christmas        per visit, for review before launch
 *   NEXT_PUBLIC_SEASONAL_CAMPAIGN=always   forces it on (used to test in-season)
 *   otherwise                              on between startsAt and endsAt
 *
 * To take the campaign down for good: see docs/christmas-mode.md.
 */

export const CHRISTMAS = {
  id: "christmas-2026",
  /** Philippine time. The window is half open: [startsAt, endsAt). */
  startsAt: "2026-11-15T00:00:00+08:00",
  endsAt: "2027-01-01T00:00:00+08:00",
  applyBy: { en: "December 10", fil: "Disyembre 10" },
  /** Where a gift card sends the person who receives it. */
  giftEntryPath: "/apply?gift=1",
} as const;

export type SeasonMode = "auto" | "always" | "off";

export function seasonMode(value: string | undefined): SeasonMode {
  return value === "off" || value === "always" ? value : "auto";
}

export function isSeasonActive(now: number, mode: SeasonMode = "auto", preview: string | null = null): boolean {
  if (mode === "off") return false;
  if (preview === "off") return false;
  if (preview === "christmas") return true;
  if (mode === "always") return true;
  return now >= Date.parse(CHRISTMAS.startsAt) && now < Date.parse(CHRISTMAS.endsAt);
}

/**
 * The script that runs in <head>. It is a string, not a function, so it ships
 * exactly as written. The unit test runs this very string against
 * isSeasonActive to keep the two in step.
 */
export function seasonBootScript(mode: SeasonMode): string {
  const starts = Date.parse(CHRISTMAS.startsAt);
  const ends = Date.parse(CHRISTMAS.endsAt);
  return `(function(d,l,D){try{`
    + `var q=new URLSearchParams(l.search).get("season"),n=D.now(),m=${JSON.stringify(mode)},`
    + `on=m==="off"?false:q==="off"?false:q==="christmas"?true:m==="always"?true:(n>=${starts}&&n<${ends});`
    + `if(on)d.documentElement.setAttribute("data-season","christmas");`
    + `}catch(e){}})(document,location,Date);`;
}
