export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <span className="brand-lockup" aria-label="SafeCard"><span className="brand-cross" aria-hidden="true">+</span>{!compact && <span>SafeCard</span>}</span>;
}
