export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-lockup" aria-label="SafeCard">
      <span className="brand-cross" aria-hidden="true">
        {/* Drawn, not typed: a "+" character sits off centre because of font metrics. */}
        <svg viewBox="0 0 24 24" width="20" height="20" focusable="false"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" /></svg>
      </span>
      {!compact && <span>SafeCard</span>}
    </span>
  );
}
