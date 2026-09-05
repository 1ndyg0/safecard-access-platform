import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SafeCard Pilot Workspace", template: "%s · SafeCard" },
  description: "A consent-first prototype for Safe Card education, sponsorship, and status support.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#09263d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
