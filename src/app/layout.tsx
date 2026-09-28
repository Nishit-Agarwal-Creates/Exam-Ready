import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Newsreader } from "next/font/google";
import Script from "next/script";
import { MotionRoot } from "@/components/motion/motion-root";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, TAGLINE, siteUrl } from "@/lib/site";
import "./globals.css";

const ui = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-ui", display: "swap", adjustFontFallback: false });
const paper = Newsreader({ subsets: ["latin"], variable: "--font-paper", display: "swap", axes: ["opsz"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE_NAME}: ${TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_IN", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", images: [OG_IMAGE.url] },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f3f5fb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${ui.variable} ${paper.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh flex flex-col">
        {/* Marks that JavaScript is running, so scroll-reveal styles never hide content without it. */}
        <Script id="js-flag" strategy="beforeInteractive">
          {"document.documentElement.classList.add('js')"}
        </Script>
        {children}
        <MotionRoot />
      </body>
    </html>
  );
}
