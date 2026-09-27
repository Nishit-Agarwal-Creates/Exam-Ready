import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AnswerKeyText, QuestionBlock } from "@/components/question-block";
import { SubjectNav } from "@/components/subject-nav";
import { searchQuestions } from "@/lib/data/questions";
import { loadSubjectPage, subjectMetaContext } from "@/lib/data/seo";
import { isRealVerifiedPyq } from "@/lib/provenance";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ board: string; class: string; subject: string }> };

async function realPyqs(subjectId: number) {
  const res = await searchQuestions({ subjectId, sourceType: "VERIFIED_PYQ", demo: "exclude", publicOnly: true, pageSize: 100 }, true);
  return res.items.filter(isRealVerifiedPyq);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = await subjectMetaContext(await params);
  if (!m) return { title: "Not found", robots: { index: false } };
  const count = (await realPyqs(m.ctx.subject.id)).length;
  return pageMetadata({
    title: `${m.name} previous-year questions`,
    description: `Verified previous-year questions for ${m.name}, grouped by exam year, each linked to its source paper, with answers.`,
    path: `${m.base}/pyq`,
    // Don't ask search engines to index an empty page.
    noindex: count === 0,
  });
}

export default async function PyqPage({ params }: Props) {
  const d = await loadSubjectPage(await params);
  const { subject, base, name } = d;
  const items = await realPyqs(subject.id);

  const byYear = new Map<number, typeof items>();
  for (const q of items) {
    const years = [...new Set(q.sources.filter((s) => !s.isDemo && s.paperType === "BOARD_EXAM" && s.year).map((s) => s.year as number))];
    const y = Math.max(...years);
    byYear.set(y, [...(byYear.get(y) ?? []), q]);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs items={[...d.crumbs, { name: "Previous-year questions", path: `${base}/pyq` }]} />
      <h1 className="text-[2.2rem] sm:text-[2.8rem]">{name} previous-year questions</h1>
      <p className="prose-width mt-3 text-[1.08rem] text-pencil">
        Only questions checked against a stored board exam paper appear here. Each one shows the paper it came from.
      </p>
      <SubjectNav base={base} current="pyq" />

      {items.length === 0 ? (
        <div className="sheet mt-8 max-w-3xl p-6 sm:p-8">
          <h2 className="text-[1.5rem]">No verified previous-year questions yet</h2>
          <p className="mt-3 text-pencil">
            {d.cls.level === 10
              ? `Verified questions from past ${d.board.name} board papers for ${subject.name} haven't been added yet. They'll appear here, grouped by year, once each one has been checked against its source paper.`
              : `There is no board exam in ${d.cls.name}, so previous questions for this class come from school papers. None have been verified and published yet.`}{" "}
            ExamReady doesn&apos;t label any question as a PYQ without a source.
          </p>
          <p className="mt-3 text-pencil">In the meantime you can still practise with the other questions for this subject, each labelled with its source.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/practice?subject=${subject.id}`} className="btn btn-primary">
              Build a {subject.name} paper
            </Link>
            <Link href={`/pyqs?subject=${subject.id}`} className="btn btn-secondary">
              Browse all {subject.name} questions
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          <p className="text-pencil">
            <strong className="num text-graphite">{items.length}</strong> verified questions from <strong className="num text-graphite">{years.length}</strong>{" "}
            exam years.
          </p>
          {years.map((y) => (
            <section key={y} aria-labelledby={`y-${y}`}>
              <h2 id={`y-${y}`} className="text-[1.7rem]">
                {d.board.name} {y}
              </h2>
              <ol className="mt-4 space-y-4">
                {byYear.get(y)!.map((q, i) => (
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
            </section>
          ))}
          <Link href={`/practice?subject=${subject.id}&mode=PYQ_ONLY`} className="btn btn-primary">
            Build a PYQ-only {subject.name} paper
          </Link>
        </div>
      )}
    </div>
  );
}
