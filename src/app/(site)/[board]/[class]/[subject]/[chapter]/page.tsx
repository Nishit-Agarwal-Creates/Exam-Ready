import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AnswerKeyText, QuestionBlock } from "@/components/question-block";
import { searchQuestions } from "@/lib/data/questions";
import { loadSubjectPage, subjectMetaContext } from "@/lib/data/seo";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ board: string; class: string; subject: string; chapter: string }> };

/** Chapters with fewer questions than this are not indexed, to avoid thin pages. */
const MIN_INDEXABLE = 5;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const m = await subjectMetaContext(p);
  const chapter = m?.ctx.chapters.find((c) => c.slug === p.chapter);
  if (!m || !chapter) return { title: "Not found", robots: { index: false } };
  const res = await searchQuestions({ subjectId: m.ctx.subject.id, chapterId: chapter.id, publicOnly: true, pageSize: 1 }, false);
  return pageMetadata({
    title: `${chapter.name}: ${m.name} questions`,
    description: `${chapter.name} for ${m.name}. ${chapter.summary} Practice questions with answers and a one-tap chapter test.`.slice(0, 300),
    path: `${m.base}/${chapter.slug}`,
    noindex: res.total < MIN_INDEXABLE,
  });
}

export default async function ChapterPage({ params }: Props) {
  const p = await params;
  const d = await loadSubjectPage(p);
  const idx = d.chapters.findIndex((c) => c.slug === p.chapter);
  if (idx < 0) notFound();
  const chapter = d.chapters[idx];
  const res = await searchQuestions({ subjectId: d.subject.id, chapterId: chapter.id, publicOnly: true, pageSize: 12 }, true);
  const s = d.stats.get(chapter.id);
  const prev = d.chapters[idx - 1];
  const next = d.chapters[idx + 1];

  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs items={[...d.crumbs, { name: chapter.name, path: `${d.base}/${chapter.slug}` }]} />
      <header className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-end">
        <div>
          <p className="font-serif text-[1.1rem] text-pencil">
            {d.name}, chapter {idx + 1}
          </p>
          <h1 className="mt-1 text-[2.2rem] sm:text-[2.8rem]">{chapter.name}</h1>
          {chapter.summary && <p className="prose-width mt-4 text-[1.08rem]">{chapter.summary}</p>}
        </div>
        <div className="sheet p-5">
          <p className="text-[0.95rem]">
            <strong className="num">{s?.total ?? 0}</strong> questions, <span className="num">{s?.marks ?? 0}</span> marks
          </p>
          {s && s.demo > 0 && <p className="text-sm text-demo">{s.demo} are demo data.</p>}
          {res.total > 0 ? (
            <Link href={`/practice?subject=${d.subject.id}&chapter=${chapter.id}`} className="btn btn-primary mt-3 w-full">
              Practise this chapter
            </Link>
          ) : (
            <p className="mt-2 text-sm text-pencil">No questions are available for this chapter yet.</p>
          )}
        </div>
      </header>

      <section className="mt-10" aria-labelledby="topics-title">
        <h2 id="topics-title" className="text-[1.6rem]">
          Topics in this chapter
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {chapter.topics.map((t) => (
            <li key={t.id} className="panel px-4 py-3 font-bold">
              {t.name}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="questions-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="questions-title" className="text-[1.6rem]">
            Practice questions
          </h2>
          {res.total > res.items.length && (
            <Link href={`/pyqs?subject=${d.subject.id}&chapter=${chapter.id}`} className="link font-bold">
              See all {res.total} questions
            </Link>
          )}
        </div>
        {res.items.length === 0 ? (
          <p className="mt-3 text-pencil">Questions for this chapter haven&apos;t been added yet.</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {res.items.map((q, i) => (
              <li key={q.id} className="sheet p-4 sm:p-6">
                <QuestionBlock number={i + 1} q={q} />
                <details className="mt-3 sm:ml-[3.25rem]">
                  <summary className="inline-flex min-h-9 cursor-pointer items-center font-bold text-ink hover:underline">Show answer</summary>
                  <div className="mt-2">
                    <AnswerKeyText q={q} />
                  </div>
                </details>
              </li>
            ))}
          </ol>
        )}
      </section>

      <nav aria-label="Other chapters" className="mt-10 grid gap-3 border-t border-rule pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={`${d.base}/${prev.slug}`} className="panel block px-4 py-3 hover:border-ink">
            <span className="block text-sm text-pencil">Previous chapter</span>
            <span className="font-bold">{prev.name}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`${d.base}/${next.slug}`} className="panel block px-4 py-3 text-right hover:border-ink">
            <span className="block text-sm text-pencil">Next chapter</span>
            <span className="font-bold">{next.name}</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
