import type { MetadataRoute } from "next";
import { getDb, schema } from "@/db";
import { getCatalog, getSubjectStats } from "@/lib/data/taxonomy";
import { absoluteUrl } from "@/lib/site";
import { and, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Only pages with real content are listed: empty PYQ pages and thin chapter pages are left out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/practice"), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/pyqs"), changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/subjects"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/how-it-works"), changeFrequency: "monthly", priority: 0.6 },
  ];
  const catalog = await getCatalog();
  const db = await getDb();
  for (const b of catalog) {
    entries.push({ url: absoluteUrl(`/${b.slug}`), changeFrequency: "weekly", priority: 0.8 });
    for (const c of b.classes) {
      entries.push({ url: absoluteUrl(`/${b.slug}/${c.slug}`), changeFrequency: "weekly", priority: 0.8 });
      for (const s of c.subjects) {
        const base = `/${b.slug}/${c.slug}/${s.slug}`;
        entries.push({ url: absoluteUrl(base), changeFrequency: "weekly", priority: 0.7 });
        entries.push({ url: absoluteUrl(`${base}/chapter-wise`), changeFrequency: "weekly", priority: 0.6 });
        const [{ n }] = await db
          .select({ n: sql<number>`count(*)` })
          .from(schema.questions)
          .where(
            and(
              eq(schema.questions.subjectId, s.id),
              eq(schema.questions.sourceType, "VERIFIED_PYQ"),
              eq(schema.questions.verificationStatus, "VERIFIED"),
              eq(schema.questions.isDemo, false),
              eq(schema.questions.isPublished, true),
            ),
          );
        if (Number(n) > 0) entries.push({ url: absoluteUrl(`${base}/pyq`), changeFrequency: "weekly", priority: 0.7 });
        const stats = await getSubjectStats(s.id);
        for (const ch of s.chapters) {
          if ((stats.get(ch.id)?.total ?? 0) >= 5) entries.push({ url: absoluteUrl(`${base}/${ch.slug}`), changeFrequency: "monthly", priority: 0.5 });
        }
      }
    }
  }
  return entries;
}
