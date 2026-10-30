"use client";

/**
 * Benefit guide: a selector list beside a detail panel with an illustration.
 *
 * Content arrives validated from the governed loader (or the repository
 * fallback) and is rendered as given; this component only lays it out.
 *
 * Accessibility: the selector is a WAI-ARIA tab list with a roving
 * tabindex, so one Tab stop enters the list and the arrow keys, Home and
 * End move between benefits. Every panel is a labelled tabpanel; panels
 * that are not selected are `hidden`, which removes them from the tab
 * order. Reduced motion is handled by the global rule in globals.css.
 *
 * Telemetry goes to the rate-limited backend endpoint with closed-set
 * fields only (benefit, event, locale, duration, random visit id).
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BenefitIcon, BenefitIllustration } from "@/components/BenefitIllustration";
import type { BenefitCard, StoryboardLocale } from "@/lib/storyboard/schema";
import type { StoryboardEventName } from "@/lib/storyboard/events";
import { fallbackStoryboard } from "@/lib/storyboard/fallback";

const COPY = {
  sample: { fil: "Halimbawang sitwasyon", en: "Sample scenario" },
  situation: { fil: "Sitwasyon", en: "Situation" },
  action: { fil: "Ano ang dapat gawin", en: "What to do" },
  mayProvide: { fil: "Maaaring gawin ng PRC", en: "What PRC may provide" },
  cost: { fil: "Tungkol sa gastos", en: "About costs" },
  listLabel: { fil: "Mga benepisyo", en: "Benefits" },
} as const;

function say(key: keyof typeof COPY, locale: StoryboardLocale): string {
  return COPY[key][locale];
}

/** Clock and randomness live at module scope so they are never called during render. */
function nowMs(): number {
  return Date.now();
}

function newVisitId(): string {
  const webCrypto = globalThis.crypto as Crypto | undefined;
  return webCrypto?.randomUUID ? webCrypto.randomUUID() : "";
}

export function BenefitStoryboard({
  cards = fallbackStoryboard.cards,
  locale,
  provenance = "provisional",
  compact = false,
}: {
  cards?: BenefitCard[];
  locale: StoryboardLocale;
  provenance?: "approved" | "provisional";
  compact?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string>(cards[0]?.id ?? "");
  const root = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const visitId = useRef<string>("");
  const openedAt = useRef<number>(0);
  const hasInteracted = useRef(false);

  const track = useCallback(
    (eventName: StoryboardEventName, benefitId: string, durationMs?: number) => {
      if (!visitId.current) visitId.current = newVisitId();
      if (!visitId.current) return;
      void fetch("/api/analytics/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: [{ benefit_id: benefitId, event_name: eventName, locale, duration_ms: durationMs ?? null, visit_id: visitId.current }],
        }),
        keepalive: true,
      }).catch(() => {
        // Telemetry is never worth a visible failure.
      });
    },
    [locale],
  );

  useEffect(() => {
    if (!visitId.current) visitId.current = newVisitId();
    // Exposes the interaction-ready boundary so automation never clicks a
    // control during the hydration gap.
    root.current?.setAttribute("data-hydrated", "true");
  }, []);

  function select(benefitId: string, { focus = false } = {}) {
    if (benefitId === selectedId) {
      if (focus) tabRefs.current[benefitId]?.focus();
      return;
    }
    if (hasInteracted.current) track("benefit_closed", selectedId, openedAt.current ? nowMs() - openedAt.current : 0);
    hasInteracted.current = true;
    openedAt.current = nowMs();
    setSelectedId(benefitId);
    track("benefit_opened", benefitId);
    if (focus) tabRefs.current[benefitId]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = cards.length - 1;
    let next = -1;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next < 0) return;
    event.preventDefault();
    select(cards[next].id, { focus: true });
  }

  return (
    <div ref={root} className={`benefit-storyboard ${compact ? "compact" : ""}`} data-hydrated="false" data-provenance={provenance}>
      <div className="benefit-layout">
        <div className="benefit-tabs" role="tablist" aria-label={say("listLabel", locale)} aria-orientation="vertical">
          {cards.map((card, index) => {
            const selected = card.id === selectedId;
            return (
              <button
                key={card.id}
                ref={(node) => { tabRefs.current[card.id] = node; }}
                type="button"
                role="tab"
                id={`storyboard-tab-${card.id}`}
                className="benefit-tab"
                aria-selected={selected}
                aria-controls={`storyboard-panel-${card.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(card.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                <span className="benefit-tab-icon"><BenefitIcon benefitId={card.id} /></span>
                <span className="benefit-tab-text">
                  <strong>{card.title[locale]}</strong>
                  <small>{card.summary[locale]}</small>
                </span>
              </button>
            );
          })}
        </div>

        <div className="benefit-stage">
          {cards.map((card) => {
            const story = card.scenario[locale];
            const selected = card.id === selectedId;
            return (
              <div
                key={card.id}
                role="tabpanel"
                id={`storyboard-panel-${card.id}`}
                aria-labelledby={`storyboard-tab-${card.id}`}
                className="benefit-panel"
                hidden={!selected}
                tabIndex={0}
              >
                <div className="benefit-side">
                  <div className="benefit-art">
                    <BenefitIllustration benefitId={card.id} />
                  </div>
                  <h3>{card.title[locale]}</h3>
                  <p className="benefit-summary">{card.summary[locale]}</p>
                </div>
                <div className="benefit-copy">
                  <p className="benefit-persona">
                    <span>{say("sample", locale)}</span>
                    <strong>{story.persona}</strong>
                  </p>

                  <dl className="benefit-facts">
                    <div><dt>{say("situation", locale)}</dt><dd>{story.situation}</dd></div>
                    <div><dt>{say("action", locale)}</dt><dd>{story.action}</dd></div>
                    <div><dt>{say("mayProvide", locale)}</dt><dd>{story.mayProvide}</dd></div>
                    {story.cost && <div><dt>{say("cost", locale)}</dt><dd>{story.cost}</dd></div>}
                  </dl>

                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
