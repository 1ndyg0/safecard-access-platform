"use client";

import { BadgeCheckIcon, BookOpenIcon, FileTextIcon, ScalesIcon } from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";
import { copy } from "@/lib/public-content";

const STEP_ICONS = [BookOpenIcon, ScalesIcon, FileTextIcon, BadgeCheckIcon];

export function ProcessTimeline() {
  const { locale } = useLocale();
  const t = copy[locale];
  return (
    <ol className="process-timeline">
      {t.steps.map((step, index) => {
        const Glyph = STEP_ICONS[index];
        return (
          <li key={step.title}>
            <div className="timeline-node">
              <span className="timeline-badge" aria-hidden="true">{index + 1}</span>
            </div>
            <div className="timeline-card">
              <span className="timeline-icon"><Glyph size={22} /></span>
              <h3><span className="sr-only">{locale === "fil" ? `Hakbang ${index + 1}: ` : `Step ${index + 1}: `}</span>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
