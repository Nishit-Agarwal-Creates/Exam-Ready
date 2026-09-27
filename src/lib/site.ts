import type { Metadata } from "next";

export const SITE_NAME = "ExamReady";
export const TAGLINE = "Practice what was actually asked.";
export const SITE_DESCRIPTION =
  "Build custom exam papers from verified previous questions, practise online, and understand exactly where you stand. ICSE Classes 8, 9 and 10.";

export function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Builds page metadata with a canonical URL and matching Open Graph/Twitter tags. */
export function pageMetadata(opts: { title: string; description: string; path: string; noindex?: boolean }): Metadata {
  const url = absoluteUrl(opts.path);
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: { title: opts.title, description: opts.description, url, siteName: SITE_NAME, type: "website", locale: "en_IN" },
    twitter: { card: "summary", title: opts.title, description: opts.description },
    robots: opts.noindex ? { index: false, follow: true } : undefined,
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}
