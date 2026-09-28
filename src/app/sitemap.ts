import type { MetadataRoute } from "next";
import { getCatalog, getSubjectStats } from "@/lib/data/taxonomy";
import { getAllCoverage, getPublicSources } from "@/lib/data/trends";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Only pages with real content are listed: empty PYQ pages, subjects with no chapters or
 * questions, and thin chapter pages are left out (those pages are also marked noindex).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/practice"), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/pyqs"), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/sources"), changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/subjects"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/how-it-works"), changeFrequency: "monthly", priority: 0.6 },
  ];
  const [catalog, coverage, sources] = await Promise.all([getCatalog(), getAllCoverage(), getPublicSources()]);
  for (const s of sources) entries.push({ url: absoluteUrl(`/sources/${s.id}`), changeFrequency: "monthly", priority: 0.5 });
  for (const b of catalog) {
    entries.push({ url: absoluteUrl(`/${b.slug}`), changeFrequency: "weekly", priority: 0.8 });
    for (const c of b.classes) {
      const classEntries: MetadataRoute.Sitemap = [];
      for (const s of c.subjects) {
        const cov = coverage.find((r) => r.subjectId === s.id);
        const stats = await getSubjectStats(s.id);
        const published = [...stats.values()].reduce((t, x) => t + x.total, 0);
        if (!s.chapters.length && !published && !cov?.verified) continue;
        const base = `/${b.slug}/${c.slug}/${s.slug}`;
        classEntries.push({ url: absoluteUrl(base), changeFrequency: "weekly", priority: 0.7 });
        if (s.chapters.length) classEntries.push({ url: absoluteUrl(`${base}/chapter-wise`), changeFrequency: "weekly", priority: 0.6 });
        if (cov && cov.verified > 0) classEntries.push({ url: absoluteUrl(`${base}/pyq`), changeFrequency: "weekly", priority: 0.8 });
        for (const ch of s.chapters) {
          if ((stats.get(ch.id)?.total ?? 0) >= 5) classEntries.push({ url: absoluteUrl(`${base}/${ch.slug}`), changeFrequency: "monthly", priority: 0.5 });
        }
      }
      // A class page is only listed when at least one of its subjects has content.
      if (classEntries.length) entries.push({ url: absoluteUrl(`/${b.slug}/${c.slug}`), changeFrequency: "weekly", priority: 0.7 }, ...classEntries);
    }
  }
  return entries;
}
