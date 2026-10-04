import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/data/taxonomy";

// The catalog lives in D1, which isn't available at build time.
export const dynamic = "force-dynamic";

/**
 * Search suggestions for the search box: every subject ("ICSE Class 10 Physics") and every distinct chapter name,
 * with how many classes it appears in. Built from the cached catalog (no question reads) and cached by the browser
 * and CDN, so the search box fetches it at most once per visit.
 */
export async function GET() {
  const catalog = await getCatalog();
  const subjects: string[] = [];
  const chapters = new Map<string, { name: string; where: Set<string> }>();
  for (const b of catalog) {
    for (const c of b.classes) {
      for (const s of c.subjects) {
        subjects.push(`${b.name} ${c.name} ${s.name}`);
        for (const ch of s.chapters) {
          const k = ch.name.toLowerCase();
          const e = chapters.get(k) ?? { name: ch.name, where: new Set<string>() };
          e.where.add(`${s.name}, ${b.name} ${c.name}`);
          chapters.set(k, e);
        }
      }
    }
  }
  const body = {
    subjects,
    // [name, a context line]: one place names it; several say how many.
    chapters: [...chapters.values()].map((e) => [e.name, e.where.size === 1 ? [...e.where][0] : `${e.where.size} subjects and classes`]),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" } });
}
