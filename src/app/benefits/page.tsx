import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { benefits } from "@/lib/public-content";
import { loadStoryboard } from "@/lib/storyboard/governed";
import { BenefitStoryboardSection } from "@/components/BenefitStoryboardSection";

export const metadata = { title: "Working SafeCard guide" };

export default async function BenefitsPage() {
  // Resolved on the server so the storyboard is in the first paint. This
  // never throws: an unreachable registry yields repository fallback.
  const { content, source } = await loadStoryboard();
  return <main className="content-page"><header className="content-nav"><Link href="/"><BrandMark /></Link><Link href="/apply" className="button-primary">Start walkthrough →</Link></header><article className="content-shell"><p className="eyebrow">Education before consent</p><h1>What the working SafeCard pilot means—and does not mean.</h1><p className="content-lede">This is a provisional product guide, not an official benefits schedule. Exact coverage, limits, eligibility, exclusions, activation, and claims rules require approved Philippine Red Cross source content before live collection opens.</p><div className="notice-panel amber"><strong>Important boundary</strong><span>Payment does not equal consent. Submission does not equal activation. Only PRC can confirm membership and decide claims.</span></div><section className="content-section"><p className="eyebrow">Benefit scenarios</p><h2>Examples an ambassador can walk through.</h2><BenefitStoryboardSection cards={content.cards} provenance={source === "approved" ? "approved" : "provisional"} /></section><section className="content-grid">{benefits.map((item, index) => <article key={item.en}><span>0{index + 1}</span><h2>{item.en}</h2><p>{item.detailEn}</p><small>{item.amount}</small></article>)}</section><section className="content-section"><p className="eyebrow">Working pilot assumptions</p><h2>Fee and eligibility still require formal validation.</h2><dl className="review-list"><div><dt>Working annual fee</dt><dd>₱1,200</dd></div><div><dt>Working age range</dt><dd>3–85 years old</dd></div><div><dt>Emergency and official questions</dt><dd>PRC Hotline 143</dd></div></dl><p>These assumptions support controlled design and testing only. The live mode stays disabled until the approved versions are published in the content registry.</p></section><div className="wizard-actions"><Link href="/apply" className="button-primary">Check my understanding →</Link><Link href="/privacy" className="button-quiet">Privacy notice</Link></div></article></main>;
}
