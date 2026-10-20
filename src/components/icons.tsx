/**
 * Small line-icon set used across the public site.
 *
 * One stroke weight, one grid (24px), rounded joins. Every icon is
 * decorative by default (`aria-hidden`); when an icon is the only content
 * of a control, the control carries the accessible name instead.
 */

import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Icon({ size = 20, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ArrowLeftIcon = (props: IconProps) => (
  <Icon {...props}><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></Icon>
);

export const ArrowRightIcon = (props: IconProps) => (
  <Icon {...props}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Icon>
);

export const MenuIcon = (props: IconProps) => (
  <Icon {...props}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}><path d="m6 6 12 12" /><path d="M18 6 6 18" /></Icon>
);

export const PhoneIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 0 0 6.9 6.9l1.3-2 4 1.6V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>
);

export const LockIcon = (props: IconProps) => (
  <Icon {...props}><rect x="5" y="10.5" width="14" height="9.5" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></Icon>
);

/* ── Benefits ─────────────────────────────────────────────────────── */

export const AmbulanceIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 17V8.5a1.5 1.5 0 0 1 1.5-1.5h9v10" />
    <path d="M13 10h4.2l3.3 3.4V17h-2" />
    <path d="M2.5 17H4" />
    <path d="M8 17h7" />
    <circle cx="6.5" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
    <path d="M8.2 9v3.6" /><path d="M6.4 10.8H10" />
  </Icon>
);

export const BloodDropIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3.2c3 3.8 6 6.8 6 10.6a6 6 0 0 1-12 0c0-3.8 3-6.8 6-10.6Z" />
    <path d="M9.4 14.2a2.8 2.8 0 0 0 2 2.4" />
  </Icon>
);

export const HospitalIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 20.5v-12l7.5-4 7.5 4v12" />
    <path d="M2.5 20.5h19" />
    <path d="M12 9v5" /><path d="M9.5 11.5h5" />
    <path d="M10 20.5v-3h4v3" />
  </Icon>
);

export const ShieldAlertIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3 4.5 6v5.6c0 4.4 3 7.6 7.5 9.4 4.5-1.8 7.5-5 7.5-9.4V6L12 3Z" />
    <path d="M12 8.4v4.2" /><path d="M12 15.6h.01" />
  </Icon>
);

/* ── Process and help ─────────────────────────────────────────────── */

export const BookOpenIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 6.5C10.4 5.2 8 4.6 4 4.6v13c4 0 6.4.6 8 1.9 1.6-1.3 4-1.9 8-1.9v-13c-4 0-6.4.6-8 1.9Z" />
    <path d="M12 6.5v13" />
  </Icon>
);

export const ScalesIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 4v16" /><path d="M7 20h10" /><path d="M5 7h14" />
    <path d="m5 7-2.6 6a3 3 0 0 0 5.2 0L5 7Z" />
    <path d="m19 7-2.6 6a3 3 0 0 0 5.2 0L19 7Z" />
  </Icon>
);

export const FileTextIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3.5V8h4.5" /><path d="M9 12.5h6" /><path d="M9 16h6" />
  </Icon>
);

export const BadgeCheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3 5 5.8v5.6c0 4.2 2.8 7.4 7 9.2 4.2-1.8 7-5 7-9.2V5.8L12 3Z" />
    <path d="m8.8 12 2.3 2.3 4.2-4.6" />
  </Icon>
);

export const InfoIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.2" /><path d="M12 7.8h.01" /></Icon>
);

export const ChatIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 12a7.5 7.5 0 0 1-11 6.6L4 20l1.4-4.5A7.5 7.5 0 1 1 20 12Z" />
    <path d="M9 11.2h6" /><path d="M9 14.2h3.6" />
  </Icon>
);

export const CalendarCheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
    <path d="M4 10h16" /><path d="M8.5 3.5v4" /><path d="M15.5 3.5v4" />
    <path d="m9.5 14.6 1.8 1.8 3.3-3.6" />
  </Icon>
);

export const UploadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 16V5" /><path d="m7.5 9.5 4.5-4.5 4.5 4.5" />
    <path d="M5 15.5v2A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5v-2" />
  </Icon>
);

export const CopyIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.2" />
    <path d="M15.5 8.5V6.7a2.2 2.2 0 0 0-2.2-2.2H6.7a2.2 2.2 0 0 0-2.2 2.2v6.6a2.2 2.2 0 0 0 2.2 2.2h1.8" />
  </Icon>
);

export const WalletIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h10.5A1.5 1.5 0 0 1 19 6.5V9" />
    <path d="M4.5 7.5V17A2.5 2.5 0 0 0 7 19.5h11A1.5 1.5 0 0 0 19.5 18v-8A1.5 1.5 0 0 0 18 8.5H7a2.5 2.5 0 0 1-2.5-1Z" />
    <circle cx="15.5" cy="14" r="1.1" />
  </Icon>
);
