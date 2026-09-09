"use client";

/**
 * Benefit storyboard accordion.
 *
 * Each header is a real <button>, so Enter and Space work because the
 * platform makes them work — not because of a keydown handler that has
 * to be kept in step with the browser. `aria-expanded` and
 * `aria-controls` connect it to its panel.
 *
 * A collapsed panel is `hidden`, not merely visually collapsed. A link
 * inside a "closed" panel that is still in the tab order is a keyboard
 * trap that sighted mouse users never encounter and never report.
 *
 * The component renders immediately from the content it is given. It
 * never waits on the network before painting, and its telemetry is
 * fire-and-forget: an analytics endpoint that is down must not stop an
 * ambassador explaining a benefit to someone in front of them.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { BenefitCard, StoryboardLocale } from "@/lib/storyboard/schema";
import type { StoryboardEventName } from "@/lib/storyboard/events";

const COPY = {
  markAsRead: { fil: "Markahan bilang nabasa", en: "Mark as read" },
  read: { fil: "Nabasa na", en: "Read" },
  progress: { fil: "Nabasa", en: "Read" },
  situation: { fil: "Sitwasyon", en: "Situation" },
  action: { fil: "Ano ang dapat gawin", en: "What to do" },
  mayProvide: { fil: "Maaaring ibigay ng PRC", en: "What PRC may provide" },
  costExample: { fil: "Halimbawa ng gastos", en: "Cost example" },
  callHotline: { fil: "Tumawag sa Hotline 143", en: "Call Hotline 143" },
  provisional: {
    fil: "Provisional na nilalaman. Ang aprubadong PRC content ang masusunod.",
    en: "Provisional content. Approved PRC content is the source of truth.",
  },
  approved: {
    fil: "Aprubadong nilalaman mula sa content registry.",
    en: "Approved content from the content registry.",
  },
} as const;

function say(key: keyof typeof COPY, locale: StoryboardLocale): string {
  return COPY[key][locale];
}

/**
 * Clock reads live at module scope so they are never called during
 * render. A timestamp taken while rendering is an impure render, and
 * React may render more than once.
 */
function nowMs(): number {
  return Date.now();
}

/** Random per visit. Not an identity, and never persisted server-side. */
function elapsedSince(start: number): number {
  return start === 0 ? 0 : nowMs() - start;
}

function newVisitId(): string {
  const webCrypto = globalThis.crypto as Crypto | undefined;
  return webCrypto?.randomUUID ? webCrypto.randomUUID() : "";
}

export function BenefitStoryboard({
  cards,
  locale,
  provenance,
}: {
  cards: BenefitCard[];
  locale: StoryboardLocale;
  provenance: "approved" | "provisional";
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const visitId = useRef<string>("");
  const openedAt = useRef<number>(0);

  /**
   * Fire-and-forget. `keepalive` lets a final event survive the page
   * being closed without the page ever awaiting the request.
   */
  const track = useCallback(
    (eventName: StoryboardEventName, benefitId: string, durationMs?: number) => {
      if (!visitId.current) visitId.current = newVisitId();
      if (!visitId.current) return;
      const body = JSON.stringify({
        events: [
          {
            benefit_id: benefitId,
            event_name: eventName,
            locale,
            duration_ms: durationMs ?? null,
            visit_id: visitId.current,
          },
        ],
      });
      void fetch("/api/analytics/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
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

  function markRead(benefitId: string) {
    if (completed.includes(benefitId)) return;
    setCompleted((current) => [...current, benefitId]);
    track("story_completed", benefitId, elapsedSince(openedAt.current));
  }

  return (
    <div className="benefit-storyboard">
      <p className="storyboard-provenance" data-provenance={provenance}>
        {provenance === "approved" ? say("approved", locale) : say("provisional", locale)}
      </p>

      {/* Completion is visible without opening anything. */}
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
            className={`story-card${isOpen ? " open" : ""}${isRead ? " read" : ""}`}
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
                {isRead && <span className="story-read-tag">{say("read", locale)}</span>}
                <span className="story-indicator" aria-hidden="true" />
              </button>
            </h3>

            {/* `hidden` removes the panel and everything in it from the
                tab order, so a closed card holds no focusable controls. */}
            <div
              className="story-panel"
              id={panelId}
              role="region"
              aria-labelledby={headerId}
              hidden={!isOpen}
            >
              <p className="story-persona">{story.persona}</p>
              <p>
                <strong>{say("situation", locale)}.</strong> {story.situation}
              </p>
              <p>
                <strong>{say("action", locale)}.</strong> {story.action}
              </p>
              <p>
                <strong>{say("mayProvide", locale)}.</strong> {story.mayProvide}
              </p>
              {story.costExample && (
                <p>
                  <strong>{say("costExample", locale)}.</strong> {story.costExample}
                </p>
              )}

              <p className="story-disclaimer">{story.disclaimer}</p>
              <p className="story-hotline-note">{story.hotlineGuidance}</p>

              <div className="story-actions">
                <a
                  className="hotline-action"
                  href="tel:143"
                  onClick={() => track("hotline_action_selected", card.id)}
                >
                  ☎ {say("callHotline", locale)}
                </a>
                <button
                  type="button"
                  className="button-quiet"
                  onClick={() => markRead(card.id)}
                  disabled={isRead}
                >
                  {isRead ? say("read", locale) : say("markAsRead", locale)}
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
