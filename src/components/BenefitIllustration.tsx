/**
 * Original vector illustrations for the four benefit topics.
 *
 * Hand-built inline SVG, not generated bitmaps: no network request, no
 * layout shift, crisp at any density, and a few hundred bytes each. All
 * four share one grid (480 x 300), one stroke weight, one palette and one
 * backdrop so they read as a set.
 *
 * The scenes are self-contained on their own dark panel, so they look the
 * same in light and dark themes. They are decorative: the heading beside
 * them carries the meaning, hence `aria-hidden`.
 *
 * `preserveAspectRatio="xMidYMid slice"` lets the panel crop gently on
 * narrow phones; every subject sits inside the central safe area.
 */

import { useId } from "react";
import { AmbulanceIcon, BloodDropIcon, HospitalIcon, ShieldAlertIcon } from "@/components/icons";
import type { BenefitId } from "@/lib/storyboard/schema";

const INK = "#0A1322";
const NAVY_1 = "#13213A";
const NAVY_2 = "#1B2D4B";
const NAVY_3 = "#2B4268";
const SLATE = "#8FA4C0";
const MIST = "#C7D3E6";
const PAPER = "#F3F6FB";
const RED = "#E5334B";
const RED_DEEP = "#B3152D";

function Backdrop({ gradientId, glowX = 330 }: { gradientId: string; glowX?: number }) {
  return (
    <>
      <defs>
        <linearGradient id={`${gradientId}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14233D" />
          <stop offset="1" stopColor={INK} />
        </linearGradient>
        <radialGradient id={`${gradientId}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={RED} stopOpacity="0.26" />
          <stop offset="1" stopColor={RED} stopOpacity="0" />
        </radialGradient>
        <pattern id={`${gradientId}-dots`} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill={SLATE} fillOpacity="0.16" />
        </pattern>
      </defs>
      <rect width="480" height="300" fill={`url(#${gradientId}-bg)`} />
      <rect width="480" height="300" fill={`url(#${gradientId}-dots)`} />
      <circle cx={glowX} cy="140" r="170" fill={`url(#${gradientId}-glow)`} />
    </>
  );
}

function AmbulanceScene({ id }: { id: string }) {
  return (
    <>
      <Backdrop gradientId={id} glowX={340} />
      {/* skyline */}
      <g fill={NAVY_1}>
        <rect x="14" y="150" width="46" height="90" rx="3" />
        <rect x="66" y="118" width="38" height="122" rx="3" />
        <rect x="110" y="168" width="34" height="72" rx="3" />
        <rect x="372" y="160" width="40" height="80" rx="3" />
        <rect x="418" y="128" width="50" height="112" rx="3" />
      </g>
      <g fill={NAVY_3} fillOpacity="0.8">
        <rect x="24" y="166" width="8" height="8" rx="1.5" /><rect x="40" y="166" width="8" height="8" rx="1.5" />
        <rect x="24" y="186" width="8" height="8" rx="1.5" /><rect x="40" y="186" width="8" height="8" rx="1.5" />
        <rect x="76" y="136" width="8" height="8" rx="1.5" /><rect x="90" y="136" width="8" height="8" rx="1.5" />
        <rect x="76" y="158" width="8" height="8" rx="1.5" /><rect x="90" y="158" width="8" height="8" rx="1.5" />
        <rect x="430" y="146" width="8" height="8" rx="1.5" /><rect x="448" y="146" width="8" height="8" rx="1.5" />
        <rect x="430" y="168" width="8" height="8" rx="1.5" /><rect x="448" y="168" width="8" height="8" rx="1.5" />
      </g>
      {/* road */}
      <rect y="238" width="480" height="62" fill="#0B1527" />
      <path d="M0 270H480" fill="none" stroke={NAVY_3} strokeWidth="3" strokeDasharray="22 16" />
      {/* route to the pin */}
      <path d="M300 118C330 58 372 66 388 96" fill="none" stroke={SLATE} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 9" />
      {/* location pin */}
      <ellipse cx="408" cy="150" rx="50" ry="12" fill="none" stroke={RED} strokeOpacity="0.28" strokeWidth="2" />
      <ellipse cx="408" cy="150" rx="28" ry="7" fill="none" stroke={RED} strokeOpacity="0.55" strokeWidth="2" />
      <path d="M408 148c-5-9-24-26-24-44a24 24 0 1 1 48 0c0 18-19 35-24 44Z" fill={RED} />
      <circle cx="408" cy="104" r="9" fill={PAPER} />
      {/* ambulance */}
      <ellipse cx="240" cy="246" rx="132" ry="9" fill="#050B16" fillOpacity="0.6" />
      <rect x="116" y="138" width="156" height="100" rx="12" fill={PAPER} />
      <path d="M272 164h38a14 14 0 0 1 11 5.4l24 30.6a14 14 0 0 1 3 8.6V226a12 12 0 0 1-12 12H272Z" fill={MIST} />
      <path d="M284 174h24a6 6 0 0 1 4.6 2.2l17 21.8H284Z" fill={NAVY_2} />
      <rect x="116" y="200" width="228" height="14" fill={RED} />
      <rect x="188" y="124" width="56" height="12" rx="5" fill={RED} />
      <rect x="196" y="127" width="14" height="6" rx="3" fill="#FFD3D9" />
      <path d="M180 120l-12-10M216 114v-14M252 120l12-10" fill="none" stroke={RED} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.8" />
      <rect x="152" y="154" width="14" height="38" rx="3" fill={RED} />
      <rect x="140" y="166" width="38" height="14" rx="3" fill={RED} />
      <rect x="338" y="214" width="9" height="12" rx="3" fill="#FFE9B0" />
      {/* wheels */}
      <g>
        <circle cx="172" cy="240" r="22" fill={INK} stroke={PAPER} strokeWidth="3" />
        <circle cx="172" cy="240" r="8" fill={SLATE} />
        <circle cx="306" cy="240" r="22" fill={INK} stroke={PAPER} strokeWidth="3" />
        <circle cx="306" cy="240" r="8" fill={SLATE} />
      </g>
    </>
  );
}

function BloodScene({ id }: { id: string }) {
  return (
    <>
      <Backdrop gradientId={id} glowX={340} />
      <defs>
        <clipPath id={`${id}-bag`}><rect x="108" y="64" width="92" height="124" rx="16" /></clipPath>
      </defs>
      {/* floor */}
      <rect y="262" width="480" height="38" fill="#0B1527" />
      {/* IV stand */}
      <path d="M154 40V262" fill="none" stroke={SLATE} strokeWidth="5" strokeLinecap="round" />
      <path d="M118 46H190" fill="none" stroke={SLATE} strokeWidth="5" strokeLinecap="round" />
      <path d="M154 262l-26 14M154 262l26 14" fill="none" stroke={SLATE} strokeWidth="5" strokeLinecap="round" />
      <circle cx="126" cy="278" r="5" fill={NAVY_3} /><circle cx="182" cy="278" r="5" fill={NAVY_3} />
      {/* bag */}
      <path d="M140 46v18M168 46v18" fill="none" stroke={SLATE} strokeWidth="3" strokeLinecap="round" />
      <rect x="108" y="64" width="92" height="124" rx="16" fill={NAVY_2} stroke={MIST} strokeWidth="3" />
      <g clipPath={`url(#${id}-bag)`}>
        <path d="M100 112c14-8 28 8 54 0s40-8 54 0v84H100Z" fill={RED} />
        <path d="M100 112c14-8 28 8 54 0s40-8 54 0v9c-14-8-28-8-54 0s-40 8-54 0Z" fill="#FF7A8C" fillOpacity="0.45" />
      </g>
      <rect x="122" y="76" width="64" height="20" rx="5" fill={NAVY_1} fillOpacity="0.85" />
      <path d="M136 80.5c3 3.4 5.4 5.4 5.4 8a5.4 5.4 0 0 1-10.8 0c0-2.6 2.4-4.6 5.4-8Z" fill={RED} />
      <path d="M148 84h28M148 90h18" fill="none" stroke={SLATE} strokeWidth="3" strokeLinecap="round" />
      {/* tube and drip chamber */}
      <path d="M154 188v14" fill="none" stroke={MIST} strokeWidth="3" strokeLinecap="round" />
      <rect x="145" y="200" width="18" height="30" rx="7" fill={NAVY_1} stroke={MIST} strokeWidth="3" />
      <path d="M154 207c2.2 2.6 3.6 4 3.6 6a3.6 3.6 0 0 1-7.2 0c0-2 1.4-3.4 3.6-6Z" fill={RED} />
      <path d="M154 230c0 24 40 14 68 4s58-6 70-26" fill="none" stroke={MIST} strokeWidth="3" strokeLinecap="round" />
      {/* emblem */}
      <circle cx="354" cy="150" r="82" fill={NAVY_1} stroke={NAVY_3} strokeWidth="2" />
      <circle cx="354" cy="150" r="62" fill={NAVY_2} />
      <path d="M354 96c-12 15-40 47-40 70a40 40 0 0 0 80 0c0-23-28-55-40-70Z" fill={RED} />
      <path d="M354 96c-12 15-40 47-40 70a40 40 0 0 0 20 34.6C318 181 322 156 354 96Z" fill={RED_DEEP} fillOpacity="0.5" />
      <path d="M333 160c1.5-11 7-20 14-29" fill="none" stroke="#FFD3D9" strokeWidth="5" strokeLinecap="round" />
      {/* heartbeat */}
      <path d="M262 262h46l10-22 16 44 12-30h68" fill="none" stroke={RED} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="426" cy="64" r="6" fill={RED} fillOpacity="0.8" />
      <circle cx="446" cy="92" r="4" fill={RED} fillOpacity="0.5" />
      <circle cx="270" cy="70" r="4" fill={SLATE} fillOpacity="0.6" />
    </>
  );
}

function HospitalScene({ id }: { id: string }) {
  const lit = [
    [204, 118], [236, 118], [268, 118], [204, 148], [268, 148], [204, 178], [236, 178],
  ];
  const dark = [[236, 148], [268, 178]];
  return (
    <>
      <Backdrop gradientId={id} glowX={240} />
      <rect y="250" width="480" height="50" fill="#0B1527" />
      {/* wings */}
      <rect x="92" y="160" width="76" height="90" rx="4" fill={NAVY_1} stroke={NAVY_3} strokeWidth="2" />
      <rect x="312" y="160" width="76" height="90" rx="4" fill={NAVY_1} stroke={NAVY_3} strokeWidth="2" />
      <g fill={NAVY_3}>
        <rect x="106" y="178" width="14" height="16" rx="2" /><rect x="140" y="178" width="14" height="16" rx="2" />
        <rect x="106" y="210" width="14" height="16" rx="2" /><rect x="140" y="210" width="14" height="16" rx="2" />
        <rect x="326" y="178" width="14" height="16" rx="2" /><rect x="360" y="178" width="14" height="16" rx="2" />
        <rect x="326" y="210" width="14" height="16" rx="2" /><rect x="360" y="210" width="14" height="16" rx="2" />
      </g>
      {/* main block */}
      <rect x="168" y="90" width="144" height="160" rx="6" fill={NAVY_2} stroke={MIST} strokeWidth="2.5" />
      <rect x="160" y="84" width="160" height="12" rx="4" fill={MIST} />
      {lit.map(([x, y]) => <rect key={`${x}-${y}`} x={x - 8} y={y - 6} width="22" height="26" rx="3" fill="#FFE9B0" fillOpacity="0.85" />)}
      {dark.map(([x, y]) => <rect key={`${x}-${y}`} x={x - 8} y={y - 6} width="22" height="26" rx="3" fill={NAVY_3} />)}
      {/* entrance */}
      <path d="M218 250v-30a22 22 0 0 1 44 0v30Z" fill={INK} />
      <path d="M240 198v52" fill="none" stroke={NAVY_3} strokeWidth="2" />
      <rect x="208" y="246" width="64" height="6" rx="2" fill={SLATE} />
      {/* sign */}
      <rect x="210" y="44" width="60" height="42" rx="8" fill={RED} />
      <rect x="236" y="52" width="8" height="26" rx="2" fill={PAPER} />
      <rect x="227" y="61" width="26" height="8" rx="2" fill={PAPER} />
      {/* checklist card */}
      <g transform="rotate(-5 410 190)">
        <rect x="364" y="132" width="104" height="110" rx="12" fill={PAPER} />
        <rect x="378" y="146" width="44" height="7" rx="3.5" fill={NAVY_3} />
        <g>
          <circle cx="388" cy="176" r="8" fill={RED} /><path d="m384 176 3 3 5-6" fill="none" stroke={PAPER} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="403" y="172" width="52" height="7" rx="3.5" fill={MIST} />
          <circle cx="388" cy="202" r="8" fill={RED} /><path d="m384 202 3 3 5-6" fill="none" stroke={PAPER} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="403" y="198" width="40" height="7" rx="3.5" fill={MIST} />
          <circle cx="388" cy="228" r="8" fill="none" stroke={SLATE} strokeWidth="2" />
          <rect x="403" y="224" width="46" height="7" rx="3.5" fill={MIST} />
        </g>
      </g>
    </>
  );
}

function ExclusionsScene({ id }: { id: string }) {
  return (
    <>
      <Backdrop gradientId={id} glowX={190} />
      {/* boundary */}
      <rect x="40" y="36" width="400" height="228" rx="22" fill="none" stroke={NAVY_3} strokeWidth="2" strokeDasharray="6 8" />
      {/* shield */}
      <path d="M170 48 246 76v66c0 48-34 80-76 98-42-18-76-50-76-98V76Z" fill={NAVY_2} stroke={MIST} strokeWidth="3" strokeLinejoin="round" />
      <path d="M170 68 228 90v52c0 36-26 62-58 78-32-16-58-42-58-78V90Z" fill={NAVY_1} />
      <rect x="161" y="108" width="18" height="54" rx="6" fill={RED} />
      <circle cx="170" cy="188" r="10" fill={RED} />
      {/* document */}
      <rect x="276" y="64" width="124" height="164" rx="12" fill={PAPER} />
      <rect x="292" y="82" width="52" height="9" rx="4.5" fill={NAVY_3} />
      <g fill={MIST}>
        <rect x="292" y="108" width="92" height="7" rx="3.5" />
        <rect x="292" y="126" width="76" height="7" rx="3.5" />
        <rect x="292" y="162" width="84" height="7" rx="3.5" />
        <rect x="292" y="180" width="60" height="7" rx="3.5" />
      </g>
      <rect x="288" y="141" width="96" height="14" rx="5" fill={RED} fillOpacity="0.2" />
      <rect x="292" y="144" width="80" height="8" rx="4" fill={RED} />
      {/* magnifier */}
      <circle cx="372" cy="196" r="30" fill={NAVY_1} fillOpacity="0.28" stroke={NAVY_2} strokeWidth="9" />
      <circle cx="372" cy="196" r="30" fill="none" stroke={MIST} strokeWidth="2" />
      <path d="m394 219 26 26" fill="none" stroke={NAVY_2} strokeWidth="11" strokeLinecap="round" />
      <path d="m394 219 26 26" fill="none" stroke={SLATE} strokeWidth="3" strokeLinecap="round" />
      <path d="M356 186a18 18 0 0 1 12-9" fill="none" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

const SCENES: Record<BenefitId, (props: { id: string }) => React.ReactNode> = {
  ambulance: AmbulanceScene,
  blood: BloodScene,
  hospital: HospitalScene,
  exclusions: ExclusionsScene,
};

export function BenefitIllustration({ benefitId, className }: { benefitId: BenefitId; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const Scene = SCENES[benefitId];
  return (
    <svg
      className={className}
      viewBox="0 0 480 300"
      preserveAspectRatio="xMidYMid slice"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <Scene id={`bi-${benefitId}-${uid}`} />
    </svg>
  );
}

const ICONS = {
  ambulance: AmbulanceIcon,
  blood: BloodDropIcon,
  hospital: HospitalIcon,
  exclusions: ShieldAlertIcon,
} as const;

export function BenefitIcon({ benefitId, size = 22 }: { benefitId: BenefitId; size?: number }) {
  const Glyph = ICONS[benefitId];
  return <Glyph size={size} />;
}
