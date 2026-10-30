"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LockIcon } from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";
import { PublicFooter } from "@/components/PublicFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { seasonalCopy as c } from "@/lib/seasonal/copy";
import { NAME_MAX, cardAltText, cardSubtitle, cardTitle, cleanName, giftMessage, giftUrl, type GiftLocale } from "@/lib/seasonal/gift";
import { SeasonSnow } from "./Season";
import "./christmas.css";

const W = 1080;
const H = 1350;
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const subscribeNothing = () => () => {};

/** Largest font size, down to a floor, at which the text still fits the width. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: string, family: string, start: number, floor: number, maxWidth: number): string {
  for (let size = start; size >= floor; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return ctx.font;
  }
  ctx.font = `${weight} ${floor}px ${family}`;
  return ctx.font;
}

function swag(ctx: CanvasRenderingContext2D, y: number, depth: number, count: number, color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  const step = W / count;
  for (let i = 0; i < count; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * step, y);
    ctx.quadraticCurveTo(i * step + step / 2, y + depth * 2, (i + 1) * step, y);
    ctx.stroke();
  }
}

function drawCard(ctx: CanvasRenderingContext2D, art: HTMLImageElement | null, to: string, from: string, locale: GiftLocale, link: string) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#FFF1D1";
  ctx.fillRect(0, 0, W, H);

  // Snow
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  for (let i = 0; i < 46; i += 1) {
    const x = (i * 211) % W;
    const y = (i * 337) % H;
    ctx.beginPath();
    ctx.arc(x, y, 3 + (i % 4) * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Light string and garland
  swag(ctx, 24, 52, 5, "#8A8A82", 3);
  const bulbs = ["#E24B4A", "#EF9F27", "#1D9E75", "#378ADD"];
  for (let i = 0; i < 5; i += 1) {
    for (let k = 1; k <= 3; k += 1) {
      const t = k / 4;
      const x0 = (i * W) / 5;
      const x1 = ((i + 1) * W) / 5;
      const cx = (x0 + x1) / 2;
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
      const y = (1 - t) * (1 - t) * 24 + 2 * (1 - t) * t * (24 + 104) + t * t * 24;
      ctx.fillStyle = bulbs[(i * 3 + k) % bulbs.length];
      ctx.beginPath();
      ctx.arc(x, y + 8, 11, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  swag(ctx, 150, 90, 4, "#0F5C46", 26);
  ctx.fillStyle = "#C8102E";
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.arc(i * (W / 4) + W / 8, 150 + 62, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#E0A526";
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc((i + 1) * (W / 4), 150 + 42, 13, 0, Math.PI * 2);
    ctx.fill();
  }

  // Gift box
  if (art) ctx.drawImage(art, 150, 300, 780, 613);

  // Words
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#0F1B2D";
  fitFont(ctx, cardTitle(to, locale), "bold", SERIF, 84, 38, 920);
  ctx.fillText(cardTitle(to, locale), W / 2, 1000);
  ctx.fillStyle = "#4E5A6E";
  fitFont(ctx, cardSubtitle(from, locale), "500", SANS, 40, 24, 920);
  ctx.fillText(cardSubtitle(from, locale), W / 2, 1066);

  ctx.fillStyle = "#C8102E";
  fitFont(ctx, c.cardBrand[locale], "bold", SANS, 34, 22, 920);
  ctx.fillText(c.cardBrand[locale], W / 2, 1150);

  ctx.fillStyle = "#0F5C46";
  ctx.fillRect(90, 1198, W - 180, 2);
  ctx.fillStyle = "#4E5A6E";
  fitFont(ctx, c.cardFooter[locale], "500", SANS, 30, 22, 900);
  ctx.fillText(c.cardFooter[locale], W / 2, 1250);
  ctx.fillStyle = "#0F1B2D";
  const shown = link.replace(/^https?:\/\//, "");
  fitFont(ctx, shown, "bold", "ui-monospace, Menlo, Consolas, monospace", 30, 18, 900);
  ctx.fillText(shown, W / 2, 1300);
}

/** /gift/card: make a gift card in the browser, then share, save or copy it. Nothing is sent or stored. */
export function GiftCardMaker() {
  const { locale: siteLocale } = useLocale();
  const ids = { from: useId(), to: useId() };
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [override, setOverride] = useState<GiftLocale | null>(null);
  const [status, setStatus] = useState("");
  const [art, setArt] = useState<HTMLImageElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const locale: GiftLocale = override ?? siteLocale;

  const origin = useSyncExternalStore(subscribeNothing, () => window.location.origin, () => "");
  const canShare = useSyncExternalStore(subscribeNothing, () => typeof navigator.share === "function", () => false);
  const link = origin ? giftUrl(origin) : "";
  const message = useMemo(() => giftMessage(to, from, link, locale), [to, from, link, locale]);

  useEffect(() => {
    const image = new Image();
    image.onload = () => setArt(image);
    image.src = "/seasonal/gift-box.svg";
  }, []);

  useEffect(() => {
    const node = canvas.current;
    const ctx = node?.getContext("2d");
    if (ctx) drawCard(ctx, art, to, from, locale, link || "safecard");
  }, [art, to, from, locale, link]);

  const toBlob = useCallback(() => new Promise<Blob | null>((resolve) => canvas.current?.toBlob(resolve, "image/png")), []);

  async function download() {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "safecard-gift.png";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(c.downloaded[locale]);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setStatus(c.copied[locale]);
    } catch {
      setStatus(c.copyFailed[locale]);
    }
  }

  async function share() {
    const blob = await toBlob();
    const files = blob ? [new File([blob], "safecard-gift.png", { type: "image/png" })] : [];
    const withFile: ShareData = { text: message, files };
    try {
      if (files.length && navigator.canShare?.(withFile)) await navigator.share(withFile);
      else await navigator.share({ text: message });
      setStatus(c.shared[locale]);
    } catch (error) {
      // Closing the share sheet is not an error.
      if (!(error instanceof DOMException && error.name === "AbortError")) setStatus(c.copyFailed[locale]);
    }
  }

  return (
    <div className="site-frame">
      <SiteHeader />
      <SeasonSnow />
      <main id="main-content">
        <div className="xmas-only">
          <div className="xmas-page">
            <header style={{ margin: "8px 0 28px" }}>
              <p className="xmas-badge">{c.badge[locale]}</p>
              <h1 className="xmas-section-title" style={{ textAlign: "left", marginBottom: 8 }}>{c.makerTitle[locale]}</h1>
              <p style={{ margin: 0, color: "var(--text2)", lineHeight: 1.6, maxWidth: "60ch" }}>{c.makerLede[locale]}</p>
            </header>

            <div className="xmas-maker">
              <form className="xmas-form" onSubmit={(event) => event.preventDefault()} aria-label={c.makerTitle[locale]}>
                <div>
                  <label htmlFor={ids.from}>{c.fromLabel[locale]}</label>
                  <input id={ids.from} type="text" name="from" value={from} maxLength={NAME_MAX * 2} autoComplete="off" onChange={(event) => setFrom(cleanName(event.target.value.slice(0, NAME_MAX * 2)))} />
                </div>
                <div>
                  <label htmlFor={ids.to}>{c.toLabel[locale]}</label>
                  <input id={ids.to} type="text" name="to" value={to} maxLength={NAME_MAX * 2} autoComplete="off" onChange={(event) => setTo(cleanName(event.target.value.slice(0, NAME_MAX * 2)))} />
                </div>
                <fieldset>
                  <legend>{c.languageLabel[locale]}</legend>
                  <div className="xmas-segment">
                    {(["en", "fil"] as const).map((value) => (
                      <label key={value}>
                        <input type="radio" name="card-language" value={value} checked={locale === value} onChange={() => setOverride(value)} />
                        <span lang={value}>{value === "en" ? "English" : "Filipino"}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <p className="xmas-hint"><LockIcon size={18} />{c.privacy[locale]}</p>
              </form>

              <div className="xmas-preview">
                <canvas ref={canvas} width={W} height={H} role="img" aria-label={`${c.previewLabel[locale]}: ${cardAltText(to, from, locale)}`} data-testid="gift-card-canvas" />
                <div className="xmas-buttons">
                  {canShare && <button type="button" className="button-primary" onClick={share}>{c.share[locale]}</button>}
                  <div className="row">
                    <button type="button" className="button-quiet" onClick={download}>{c.download[locale]}</button>
                    <button type="button" className="button-quiet" onClick={copy}>{c.copy[locale]}</button>
                  </div>
                </div>
                <p className="xmas-status" role="status" aria-live="polite">{status}</p>
                <p className="xmas-message"><strong>{c.messagePreview[locale]}</strong>{message}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
