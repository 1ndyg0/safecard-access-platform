import type { Metadata } from "next";
import "./globals.css";
import { LocaleProvider } from "@/components/LocaleProvider";

export const metadata: Metadata = {
  title: "SafeCard Access Platform",
  description: "SafeCard education and application with manual Philippine Red Cross bank transfer.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://safecard-access-platform.vercel.app"),
  robots: { index: false, follow: false },
};

type Props = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: Props) {
  return (
    <html
      lang="fil"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
