"use client";

/**
 * Benefit storyboard accordion.
 *
 * Presentation is the payment/storyboards branch's: the grid header, the
 * rotating indicator, and the `grid-template-rows` panel transition. Two
 * of its choices are load-bearing and were kept deliberately rather than
 * replaced:
 *
 *   - The closed panel uses `visibility: hidden`, which removes its
 *     contents from the tab order. A link inside a visually closed panel
 *     that is still tabbable is a keyboard trap mouse users never
 *     encounter and never report. `tabIndex={-1}` on the interactive
 *     elements is a second belt for the same trousers.
 *   - Reduced motion is handled by a global rule, so this component does
 *     not need its own media query.
 *
 * What this module adds: content arrives validated from the governed
 * loader rather than being imported statically, completion is an
 * explicit action instead of a side effect of opening, provenance is
 * stated, and telemetry goes to the rate-limited backend endpoint
 * instead of a window event with no consumer.
 *
 * Each header is a real <button>, so Enter and Space work because the
 * platform makes them work — not because of a keydown handler that has
 * to be kept in step with the browser.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { BenefitCard, StoryboardLocale } from "@/lib/storyboard/schema";
import type { StoryboardEventName } from "@/lib/storyboard/events";
import { fallbackStoryboard } from "@/lib/storyboard/fallback";

const COPY = {
  markAsRead: { fil: "Markahan bilang nabasa", en: "Mark as read" },
  read: { fil: "Nabasa na", en: "Read" },
  progress: { fil: "Nabasa", en: "Read" },
  situation: { fil: "Sitwasyon", en: "Situation" },
  action: { fil: "Ano ang dapat gawin", en: "What to do" },
  mayProvide: { fil: "Maaaring gawin ng PRC", en: "What PRC may provide" },
  cost: { fil: "Halimbawa ng gastos", en: "Cost example" },
  callHotline: { fil: "Tumawag sa Hotline 143", en: "Call Hotline 143" },
  provisional: {
    fil: "Provisional na nilalaman. Ang approved PRC content registry ang source of truth bago ang live pilot.",
    en: "Provisional content. The approved PRC content registry is the source of truth before the live pilot.",
  },
  approved: {
    fil: "Approved na nilalaman mula sa PRC content registry.",
    en: "Approved content from the PRC content registry.",
  },
} as const;

function say(key: keyof typeof COPY, locale: StoryboardLocale): string {
  return COPY[key][locale];
}

/**
 * Clock and randomness live at module scope so they are never called
 * during render. A value produced while rendering is an impure render,
 * and React may render more than once.
 */
function nowMs(): number {
  return Date.now();
}

function elapsedSince(start: number): number {
  return start === 0 ? 0 : nowMs() - start;
}

function newVisitId(): string {
  const webCrypto = globalThis.crypto as Crypto | undefined;
  return webCrypto?.randomUUID ? webCrypto.randomUUID() : "";
}

export function BenefitStoryboard({
  // Optional so surfaces that only teaser the storyboard (the landing
  // page) need no server round-trip. They get the repository fallback,
  // which is labelled provisional — the honest description of content
  // that has not been through the registry.
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
  const [openId, setOpenId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const visitId = useRef<string>("");
  const openedAt = useRef<number>(0);

  /**
   * Fire-and-forget. `keepalive` lets a final event survive the page
   * closing without the page ever awaiting the request.
   */
  const track = useCallback(
    (eventName: StoryboardEventName, benefitId: string, durationMs?: number) => {
      if (!visitId.current) visitId.current = newVisitId();
      if (!visitId.current) return;
      void fetch("/api/analytics/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: [
            {
              benefit_id: benefitId,
              event_name: eventName,
              locale,
              duration_ms: durationMs ?? null,
              visit_id: visitId.current,
            },
          ],
        }),
        keepalive: true,
      }).catch(() => {
        // Telemetry is never worth a visible failure.
      });
    },
    [locale],
  );

  // Generated after mount so the first paint owes nothing to crypto.
  useEffect(() => {
    if (!visitId.current) visitId.current = newVisitId();
  }, []);

  function toggle(benefitId: string) {
    const closing = openId === benefitId;
    if (openId && openId !== benefitId) {
      track("benefit_closed", openId, elapsedSince(openedAt.current));
    }
    if (closing) {
      track("benefit_closed", benefitId, elapsedSince(openedAt.current));
      setOpenId(null);
      return;
    }
    openedAt.current = nowMs();
    setOpenId(benefitId);
    track("benefit_opened", benefitId);
  }

  /**
   * Completion is an explicit action, not a side effect of opening.
   * Auto-completing on open would make the completion rate a second,
   * noisier copy of the open rate.
   */
  function markRead(benefitId: string) {
    if (completed.includes(benefitId)) return;
    setCompleted((current) => [...current, benefitId]);
    track("story_completed", benefitId, elapsedSince(openedAt.current));
  }

  return (
    <div
      className={`benefit-storyboard ${compact ? "compact" : ""}`}
      aria-label={locale === "fil" ? "Mga benepisyo at halimbawa" : "Benefits and examples"}
    >
      <p className="storyboard-progress" aria-live="polite">
        {say("progress", locale)}: {completed.length}/{cards.length}
      </p>

      {cards.map((card, index) => {
        const panelId = `storyboard-panel-${card.id}`;
        const headerId = `storyboard-header-${card.id}`;
        const isOpen = openId === card.id;
        const isRead = completed.includes(card.id);
        const story = card.scenario[locale];

        return (
          <article
            className={`story-card ${isOpen ? "open" : ""} ${isRead ? "read" : ""}`}
            key={card.id}
          >
            <h3 className="story-heading">
              <button
                type="button"
                id={headerId}
                className="story-header"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(card.id)}
              >
                <span className="story-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="story-icon" aria-hidden="true">
                  {card.icon}
                </span>
                <span className="story-title">
                  <strong>{card.title[locale]}</strong>
                  <small>{card.summary[locale]}</small>
                </span>
                <span className="story-indicator" aria-hidden="true" />
              </button>
            </h3>

            <div
              className={`story-panel-shell ${isOpen ? "open" : ""}`}
              id={panelId}
              aria-hidden={!isOpen}
            >
              <div className="story-panel" role="region" aria-labelledby={headerId}>
                <div className="story-panel-content">
                  <p className="story-persona">
                    <strong>{story.persona}</strong>
                  </p>
                  <p>
                    <strong>{say("situation", locale)}.</strong> {story.situation}
                  </p>
                  <p>
                    <strong>{say("action", locale)}.</strong> {story.action}
                  </p>
                  <p>
                    <strong>{say("mayProvide", locale)}.</strong> {story.mayProvide}
                  </p>
                  {story.cost && (
                    <p>
                      <strong>{say("cost", locale)}.</strong> {story.cost}
                    </p>
                  )}

                  <p className="story-disclaimer">{story.disclaimer}</p>
                  {story.hotlineGuidance && (
                    <p className="story-hotline-note">{story.hotlineGuidance}</p>
                  )}

                  <div className="story-actions">
                    <a
                      className="hotline-action"
                      href="tel:143"
                      // Second guard alongside `visibility: hidden`.
                      tabIndex={isOpen ? undefined : -1}
                      onClick={() => track("hotline_action_selected", card.id)}
                    >
                      ☎ {say("callHotline", locale)}
                    </a>
                    <button
                      type="button"
                      className="button-quiet story-read-action"
                      tabIndex={isOpen ? undefined : -1}
                      onClick={() => markRead(card.id)}
                      disabled={isRead}
                    >
                      {isRead ? say("read", locale) : say("markAsRead", locale)}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        );
      })}

      <p className="content-footnote" data-provenance={provenance}>
        {provenance === "approved" ? say("approved", locale) : say("provisional", locale)}
      </p>
    </div>
  );
}
