"use client";

import { useState } from "react";
import { benefitStoryboards, type StoryboardLocale } from "@/lib/benefit-storyboards";

function track(event: string, benefitId: string, locale: StoryboardLocale) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("safecard-analytics", { detail: { event, benefitId, locale } }));
}

export function BenefitStoryboard({ locale, compact = false }: { locale: StoryboardLocale; compact?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);

  function toggle(id: string) {
    const next = openId === id ? null : id;
    if (next) track("benefit_opened", id, locale);
    else track("benefit_closed", id, locale);
    setOpenId(next);
    if (next && !completed.includes(id)) {
      setCompleted((current) => [...current, id]);
      track("story_completed", id, locale);
    }
  }

  return <div className={`benefit-storyboard ${compact ? "compact" : ""}`} aria-label={locale === "fil" ? "Mga benepisyo at halimbawa" : "Benefits and examples"}>
    {benefitStoryboards.map((benefit, index) => {
      const isOpen = openId === benefit.id;
      const panelId = `story-${benefit.id}`;
      const story = benefit.scenario[locale];
      return <article className={`story-card ${isOpen ? "open" : ""}`} key={benefit.id}>
        <button type="button" className="story-header" aria-expanded={isOpen} aria-controls={panelId} onClick={() => toggle(benefit.id)}>
          <span className="story-number">0{index + 1}</span><span className="story-icon" aria-hidden="true">{benefit.icon}</span><span className="story-title"><strong>{benefit.title[locale]}</strong><small>{benefit.summary[locale]}</small></span><span className="story-indicator" aria-hidden="true">{isOpen ? "−" : "+"}</span>
        </button>
        {isOpen && <div className="story-panel" id={panelId} role="region" aria-labelledby={`${panelId}-heading`}>
          <h3 id={`${panelId}-heading`}>{story.persona}</h3>
          <p><strong>{locale === "fil" ? "Sitwasyon" : "Situation"}.</strong> {story.situation}</p>
          <p><strong>{locale === "fil" ? "Ano ang dapat gawin" : "What to do"}.</strong> {story.action}</p>
          <p><strong>{locale === "fil" ? "Maaaring gawin ng PRC" : "What PRC may provide"}.</strong> {story.mayProvide}</p>
          <p><strong>{locale === "fil" ? "Halimbawa ng gastos" : "Cost example"}.</strong> {story.cost}</p>
          <p className="story-disclaimer">{story.disclaimer}</p>
          <a className="hotline-action" href="tel:143" onClick={() => track("hotline_action_selected", benefit.id, locale)}>☎ {locale === "fil" ? "Tumawag sa Hotline 143" : "Call Hotline 143"}</a>
        </div>}
      </article>;
    })}
    <p className="content-footnote">{locale === "fil" ? "Provisional fallback content. Ang approved PRC content registry ang source of truth bago ang live pilot." : "Provisional fallback content. The approved PRC content registry is the source of truth before the live pilot."}</p>
  </div>;
}
