import { BackLink } from "@/components/BackLink";
import { PublicFooter } from "@/components/PublicFooter";
import { SiteHeader } from "@/components/SiteHeader";

/**
 * Frame for public content pages: header, a back control in the same place
 * on every page, the page content as <main>, and the footer.
 */
export function PublicPage({ children, fallbackHref = "/", wide = false }: { children: React.ReactNode; fallbackHref?: string; wide?: boolean }) {
  return (
    <div className="site-frame">
      <SiteHeader />
      <main id="main-content" className={`page-main ${wide ? "wide" : ""}`}>
        <div className="page-toolbar"><BackLink fallbackHref={fallbackHref} /></div>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
