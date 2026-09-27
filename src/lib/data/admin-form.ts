import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { FormCatalogSubject, FormPaper } from "@/components/admin/question-form";
import { getCatalog } from "./taxonomy";

/** Subjects with chapters and topics, plus source papers, for the admin question form. */
export async function getFormData(): Promise<{ catalog: FormCatalogSubject[]; papers: FormPaper[] }> {
  const db = await getDb();
  const [catalog, topics, papers] = await Promise.all([
    getCatalog(),
    db.select({ id: schema.topics.id, chapterId: schema.topics.chapterId, name: schema.topics.name }).from(schema.topics).orderBy(asc(schema.topics.sortOrder)),
    db
      .select({
        id: schema.papers.id,
        subjectId: schema.papers.subjectId,
        title: schema.papers.title,
        year: schema.papers.year,
        paperType: schema.papers.paperType,
        isDemo: schema.papers.isDemo,
      })
      .from(schema.papers)
      .orderBy(asc(schema.papers.title)),
  ]);
  return {
    catalog: catalog.flatMap((b) =>
      b.classes.flatMap((c) =>
        c.subjects.map((s) => ({
          id: s.id,
          label: `${b.name} ${c.name} ${s.name}`,
          chapters: s.chapters.map((ch) => ({ id: ch.id, name: ch.name, topics: topics.filter((t) => t.chapterId === ch.id).map(({ id, name }) => ({ id, name })) })),
        })),
      ),
    ),
    papers,
  };
}
