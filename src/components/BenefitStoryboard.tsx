"use client";

import { useEffect, useRef, useState } from "react";
import { benefitStoryboards, type BenefitStoryboard as BenefitStoryboardItem, type StoryboardLocale } from "@/lib/benefit-storyboards";

function track(event: "benefit_opened" | "benefit_closed" | "story_completed" | "hotline_action_selected", benefitId: string, locale: StoryboardLocale, durationMs?: number) {
  if (typeof window === "undefined") return;
  const detail = { event, benefitId, locale, ...(durationMs === undefined ? {} : { durationMs }) };
  window.dispatchEvent(new CustomEvent("safecard-analytics", { detail }));
  void fetch("/api/analytics/storyboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(detail),
    keepalive: true,
  }).catch(() => undefined);
}

export function BenefitStoryboard({ locale, compact = false }: { locale: StoryboardLocale; compact?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [stories, setStories] = useState<BenefitStoryboardItem[]>(benefitStoryboards);
  const [approved, setApproved] = useState(false);
  const openedAt = useRef<Record<string, number>>({});

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/content/storyboards?locale=${locale}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Storyboard content unavailable");
        return response.json();
      })
      .then((data: { stories: BenefitStoryboardItem[]; approved: boolean }) => {
        setStories(data.stories);
        setApproved(data.approved);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [locale]);

  function toggle(id: string, eventTime: number) {
    const next = openId === id ? null : id;
    if (openId && openId !== next) {
      track("benefit_closed", openId, locale, Math.round(eventTime - (openedAt.current[openId] ?? eventTime)));
    }
    if (next) {
      openedAt.current[id] = eventTime;
      track("benefit_opened", id, locale);
    } else {
      track("benefit_closed", id, locale, Math.round(eventTime - (openedAt.current[id] ?? eventTime)));
    }
    setOpenId(next);
  }

  function complete(id: string, eventTime: number) {
    if (completed.includes(id)) return;
    setCompleted((current) => [...current, id]);
    track("story_completed", id, locale, Math.round(eventTime - (openedAt.current[id] ?? eventTime)));
  }

  return <div className={`benefit-storyboard ${compact ? "compact" : ""}`} aria-label={locale === "fil" ? "Mga benepisyo at halimbawa" : "Benefits and examples"}>
    {stories.map((benefit, index) => {
      const isOpen = openId === benefit.id;
      const panelId = `story-${benefit.id}`;
      const story = benefit.scenario[locale];
      return <article className={`story-card ${isOpen ? "open" : ""}`} key={benefit.id}>
        <button type="button" className="story-header" aria-expanded={isOpen} aria-controls={panelId} onClick={(event) => toggle(benefit.id, event.timeStamp)}>
          <span className="story-number">0{index + 1}</span><span className="story-icon" aria-hidden="true">{benefit.icon}</span><span className="story-title"><strong>{benefit.title[locale]}</strong><small>{benefit.summary[locale]}</small></span><span className="story-indicator" aria-hidden="true" />
        </button>
        <div className={`story-panel-shell ${isOpen ? "open" : ""}`} id={panelId} aria-hidden={!isOpen}>
          <div className="story-panel" role="region" aria-labelledby={`${panelId}-heading`}>
            <div className="story-panel-content">
              <h3 id={`${panelId}-heading`}>{story.persona}</h3>
              <p><strong>{locale === "fil" ? "Sitwasyon" : "Situation"}.</strong> {story.situation}</p>
              <p><strong>{locale === "fil" ? "Ano ang dapat gawin" : "What to do"}.</strong> {story.action}</p>
              <p><strong>{locale === "fil" ? "Maaaring gawin ng PRC" : "What PRC may provide"}.</strong> {story.mayProvide}</p>
              <p><strong>{locale === "fil" ? "Halimbawa ng gastos" : "Cost example"}.</strong> {story.cost}</p>
              <p className="story-disclaimer">{story.disclaimer}</p>
              <a className="hotline-action" href="tel:143" tabIndex={isOpen ? undefined : -1} onClick={() => track("hotline_action_selected", benefit.id, locale)}>☎ {locale === "fil" ? "Tumawag sa Hotline 143" : "Call Hotline 143"}</a>
              <button className="story-complete" type="button" tabIndex={isOpen ? undefined : -1} disabled={completed.includes(benefit.id)} onClick={(event) => complete(benefit.id, event.timeStamp)}>
                {completed.includes(benefit.id) ? (locale === "fil" ? "✓ Nabasa ko na" : "✓ Marked as read") : (locale === "fil" ? "Nabasa ko ang halimbawang ito" : "I have read this example")}
              </button>
            </div>
          </div>
        </div>
      </article>;
    })}
    <p className="content-footnote">{approved
      ? (locale === "fil" ? "Ang nilalamang ito ay mula sa approved content registry." : "This content is served from the approved content registry.")
      : (locale === "fil" ? "Provisional fallback content. Ang approved PRC content registry ang source of truth bago ang live pilot." : "Provisional fallback content. The approved PRC content registry is the source of truth before the live pilot.")}</p>
  </div>;
}
