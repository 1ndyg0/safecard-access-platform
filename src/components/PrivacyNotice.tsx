"use client";

import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";

const COPY = {
  fil: {
    eyebrow: "Privacy at karapatan",
    title: "Ang iyong pasya ay bago ang iyong datos.",
    lede: "Ipinapaliwanag ng paunawang ito kung paano hinahawakan ng SafeCard ang iyong impormasyon at kung anong mga pagpipilian ang mayroon ka.",
    items: [
      ["Kusang-loob na pagpili", "Maaari kang tumanggap, magtanong, tumanggi, o umatras. Nananatiling pribado ang iyong pinili."],
      ["Minimum na datos", "Kinokolekta lamang ang mga field na kailangan sa application, pagkatapos mong magbasa at magbigay ng pahintulot."],
      ["Limitadong gamit", "Ginagamit ang iyong impormasyon para sa iyong application, payment verification, suporta, seguridad, at mga audit record na kailangan."],
      ["Limitadong access", "Tinitiyak ng role checks at row-level security na ang mga staff ay nakakakita lamang ng kailangan sa kanilang tungkulin."],
      ["Iyong mga karapatan", "Maaari kang humiling ng access, correction, pag-atras, o tulong. Hindi mabubura ng pag-atras ang mga record na kailangang itago ayon sa batas para sa audit."],
      ["Shared devices", "Gamitin ang clear-device action at isara ang browser. Nag-e-expire ang member session pagkalipas ng 30 minuto at nakaimbak sa secure at HTTP-only na cookies."],
    ],
  },
  en: {
    eyebrow: "Privacy and rights",
    title: "Your choice comes before your data.",
    lede: "This notice explains how SafeCard handles your information and what choices you have.",
    items: [
      ["Voluntary choice", "You may accept, ask, decline, or withdraw. Your choice stays private."],
      ["Minimum data", "Only the fields needed for the application are collected, after you have read the information and given consent."],
      ["Purpose limitation", "Your information is used for your application, payment verification, support, security, and required audit records."],
      ["Restricted access", "Role checks and row-level security make sure staff see only what their role requires."],
      ["Your rights", "You may request access, correction, withdrawal, or assistance. Withdrawal cannot erase records that must be kept by law for audit."],
      ["Shared devices", "Use the clear-device action and close the browser. Member sessions expire after 30 minutes and are stored in secure, HTTP-only cookies."],
    ],
  },
} as const;

export function PrivacyNotice() {
  const { locale } = useLocale();
  const t = COPY[locale];
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="content-lede">{t.lede}</p>
      </header>
      <div className="content-grid privacy-grid">
        {t.items.map(([title, body], index) => (
          <article key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </div>
      <div className="page-actions">
        <Link href="/apply" className="button-primary">{locale === "fil" ? "Mag-apply na" : "Apply now"}</Link>
        <Link href="/help" className="button-quiet">{locale === "fil" ? "Kumuha ng tulong" : "Get help"}</Link>
      </div>
    </>
  );
}
