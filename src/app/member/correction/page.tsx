import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { BrandMark } from "@/components/BrandMark";
import { CorrectionForm } from "@/components/member/CorrectionForm";

export default function MemberCorrectionPage() {
  return (
    <main className="portal-page">
      <div className="portal-shell">
        <header className="portal-header">
          <Link href="/">
            <BrandMark />
          </Link>
          <Link href="/member/status" className="button-quiet">
            Status
          </Link>
        </header>
        <div className="portal-toolbar"><BackLink fallbackHref="/member/status" /></div>
        <section className="portal-card">
          <p className="eyebrow">Protected correction</p>
          <CorrectionForm />
        </section>
      </div>
    </main>
  );
}
