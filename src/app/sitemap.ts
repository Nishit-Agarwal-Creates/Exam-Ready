import type { MetadataRoute } from "next";
import { getPublishedByChapter, getSubjectCoverage, publishedTotal } from "@/lib/data/coverage";
import { getPublicSources } from "@/lib/data/trends";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Only pages with real content are listed: empty PYQ hubs, subjects with no published
 * questions, and thin chapter pages are left out (those pages are also marked noindex).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/practice"), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/pyqs"), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/pyq"), changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/coverage"), changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/sources"), changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/subjects"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/how-it-works"), changeFrequency: "monthly", priority: 0.6 },
  ];
  // A handful of grouped queries for the whole catalogue; no per-subject queries.
  const [coverage, chapters, sources] = await Promise.all([getSubjectCoverage(), getPublishedByChapter(), getPublicSources()]);
  for (const s of sources) entries.push({ url: absoluteUrl(`/sources/${s.id}`), changeFrequency: "monthly", priority: 0.5 });
  const boards = new Set<string>();
  const classes = new Set<string>();
  const pyqBoards = new Set<string>();
  const pyqClasses = new Set<string>();
  for (const r of coverage) {
    const published = publishedTotal(r);
    if (!published) continue;
    const base = `/${r.boardSlug}/${r.classSlug}/${r.subjectSlug}`;
    boards.add(r.boardSlug);
    classes.add(`${r.boardSlug}/${r.classSlug}`);
    entries.push({ url: absoluteUrl(base), changeFrequency: "weekly", priority: 0.7 });
    if (r.chapterCount) entries.push({ url: absoluteUrl(`${base}/chapter-wise`), changeFrequency: "weekly", priority: 0.6 });
    for (const ch of chapters.get(r.subjectId) ?? []) {
      if (ch.published >= 5) entries.push({ url: absoluteUrl(`${base}/${ch.slug}`), changeFrequency: "monthly", priority: 0.5 });
    }
    // PYQ hubs are listed only where verified PYQs exist.
    if (r.verifiedPyq > 0) {
      pyqBoards.add(r.boardSlug);
      pyqClasses.add(`${r.boardSlug}/${r.classSlug}`);
      entries.push({ url: absoluteUrl(`/pyq${base}`), changeFrequency: "weekly", priority: 0.8 });
    }
  }
  for (const b of boards) entries.push({ url: absoluteUrl(`/${b}`), changeFrequency: "weekly", priority: 0.8 });
  for (const c of classes) entries.push({ url: absoluteUrl(`/${c}`), changeFrequency: "weekly", priority: 0.7 });
  for (const b of pyqBoards) entries.push({ url: absoluteUrl(`/pyq/${b}`), changeFrequency: "weekly", priority: 0.7 });
  for (const c of pyqClasses) entries.push({ url: absoluteUrl(`/pyq/${c}`), changeFrequency: "weekly", priority: 0.7 });
  return entries;
}
