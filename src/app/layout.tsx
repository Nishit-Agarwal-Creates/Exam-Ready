import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Newsreader } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, TAGLINE, siteUrl } from "@/lib/site";
import "./globals.css";

const ui = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-ui", display: "swap", adjustFontFallback: false });
const paper = Newsreader({ subsets: ["latin"], variable: "--font-paper", display: "swap", axes: ["opsz"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE_NAME}: ${TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_IN" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#eef2f1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${ui.variable} ${paper.variable}`}>
      <body className="min-h-dvh flex flex-col">
        {children}
      </body>
    </html>
  );
}
