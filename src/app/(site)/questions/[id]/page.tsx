import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AnswerKeyText, QuestionBlock } from "@/components/question-block";
import { getDb, schema } from "@/db";
import { includeDemoData } from "@/lib/data/papers";
import { getQuestionViews, searchQuestions } from "@/lib/data/questions";
import { citation, frequencyLine, isRealVerifiedPyq, SOURCE_LABELS } from "@/lib/provenance";
import { pageMetadata } from "@/lib/site";
import { similarity } from "@/lib/text";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** A published question with its board/class/subject context, or null. Unpublished or rejected questions are never shown. */
async function load(idStr: string) {
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return null;
  const db = await getDb();
  const [ctx] = await db
    .select({
      boardSlug: schema.boards.slug,
      board: schema.boards.name,
      classSlug: schema.classes.slug,
      cls: schema.classes.name,
      subjectId: schema.subjects.id,
      subjectSlug: schema.subjects.slug,
      subject: schema.subjects.name,
    })
    .from(schema.questions)
    .innerJoin(schema.boards, eq(schema.questions.boardId, schema.boards.id))
    .innerJoin(schema.classes, eq(schema.questions.classId, schema.classes.id))
    .innerJoin(schema.subjects, eq(schema.questions.subjectId, schema.subjects.id))
    .where(eq(schema.questions.id, id));
  if (!ctx) return null;
  const q = (await getQuestionViews([id], true)).get(id);
  if (!q || !q.isPublished || q.verificationStatus === "REJECTED") return null;
  if (q.verificationStatus !== "VERIFIED" && q.sourceType !== "AI_SUPPLEMENTARY") return null;
  if (q.isDemo && !(await includeDemoData())) return null;
  return { q, ctx };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load((await params).id);
  if (!r) return { title: "Question not found", robots: { index: false } };
  const { q, ctx } = r;
  const real = isRealVerifiedPyq(q);
  const src = q.sources.find((s) => !s.isDemo);
  const label = real && src ? citation(src) : SOURCE_LABELS[q.isDemo ? "AI_SUPPLEMENTARY" : q.sourceType].short;
  return pageMetadata({
    title: `${q.chapter.name} question (${label})`,
    description: `${q.text.slice(0, 140)}${q.text.length > 140 ? "…" : ""} ${ctx.board} ${ctx.cls} ${ctx.subject}, ${q.marks} marks.`,
    path: `/questions/${q.id}`,
    // Only verified official questions are indexed; AI practice pages are for students, not search.
    noindex: !(real || (q.sourceType === "OFFICIAL_SAMPLE" && q.verificationStatus === "VERIFIED")),
  });
}

export default async function QuestionPage({ params }: Props) {
  const r = await load((await params).id);
  if (!r) notFound();
  const { q, ctx } = r;
  const subjectPath = `/${ctx.boardSlug}/${ctx.classSlug}/${ctx.subjectSlug}`;
  const freq = frequencyLine(q, q.groupSources);
  const includeDemo = await includeDemoData();

  // Similar wording in the same chapter, ranked by word overlap (small, bounded set).
  const pool = await searchQuestions({ subjectId: ctx.subjectId, chapterId: q.chapter.id, publicOnly: true, demo: includeDemo ? undefined : "exclude", pageSize: 60 }, false, { light: true });
  const similar = pool.items
    .filter((x) => x.id !== q.id && (x.canonicalId ?? x.id) !== (q.canonicalId ?? q.id))
    .map((x) => ({ x, score: similarity(q.text, x.text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  // Other appearances of this exact question (its duplicate group), from stored links only.
  const otherPapers = q.groupSources.filter((s) => !q.sources.some((own) => own.paperId === s.paperId));

  return (
    <div className="container-page page-enter py-8 sm:py-12">
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: ctx.board, path: `/${ctx.boardSlug}` },
          { name: ctx.cls, path: `/${ctx.boardSlug}/${ctx.classSlug}` },
          { name: ctx.subject, path: subjectPath },
          { name: q.chapter.name, path: `${subjectPath}/${q.chapter.slug}` },
          { name: `Question ${q.id}`, path: `/questions/${q.id}` },
        ]}
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <h1 className="text-[1.6rem] sm:text-[2rem]">
            {q.chapter.name}
            <span className="block font-sans text-[1rem] font-bold text-pencil">
              {ctx.board} {ctx.cls} {ctx.subject}
            </span>
          </h1>
          <div className="sheet mt-5 p-4 sm:p-6">
            <QuestionBlock number="Q" q={q} headingLevel={2} />
            <details className="mt-4 sm:ml-[3.25rem]">
              <summary className="inline-flex min-h-9 cursor-pointer items-center font-bold text-ink hover:underline">Show answer</summary>
              <div className="mt-2">
                <AnswerKeyText q={q} />
              </div>
            </details>
          </div>
          {freq && <p className="mt-4 rounded-xl border border-verified/30 bg-verified-soft/50 px-4 py-3 font-bold text-verified">{freq}</p>}

          {otherPapers.length > 0 && (
            <section className="mt-8" aria-labelledby="repeat-title">
              <h2 id="repeat-title" className="text-[1.4rem]">
                The same question in other papers
              </h2>
              <ul className="mt-3 space-y-2">
                {otherPapers.map((s) => (
                  <li key={s.paperId} className="panel rounded-xl px-4 py-3">
                    <Link href={`/sources/${s.paperId}`} className="link font-bold">
                      {citation(s)}
                    </Link>
                    <span className="block text-[0.9rem] text-pencil">{s.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section id="similar" className="mt-8 scroll-mt-24" aria-labelledby="similar-title">
            <h2 id="similar-title" className="text-[1.4rem]">
              Similar questions in {q.chapter.name}
            </h2>
            {similar.length === 0 ? (
              <p className="mt-3 text-pencil">No other published questions in this chapter yet.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {similar.map(({ x }, i) => (
                  <li key={x.id} className="sheet p-4">
                    <QuestionBlock number={i + 1} q={x} headingLevel={3} provenance="line" />
                    <Link href={`/questions/${x.id}`} className="link mt-2 inline-block text-[0.9rem] sm:ml-[3.25rem]">
                      Open this question
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <Link href={`/practice?subject=${ctx.subjectId}&chapter=${q.chapter.id}`} className="btn btn-primary w-full whitespace-normal text-center" data-fx="pulse">
            Practise this chapter
          </Link>
          {isRealVerifiedPyq(q) && (
            <Link href={`/pyq${subjectPath}/${q.chapter.slug}`} className="btn btn-secondary w-full whitespace-normal text-center">
              All PYQs in this chapter
            </Link>
          )}
          <Link href={`/search?q=${encodeURIComponent(q.chapter.name)}&subject=${ctx.subjectId}`} className="btn btn-ghost w-full">
            Search this chapter
          </Link>
        </aside>
      </div>
    </div>
  );
}
