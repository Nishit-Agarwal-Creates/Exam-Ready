import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompositionBar } from "@/components/composition";
import { PaperActions } from "@/components/paper-actions";
import { PaperHeader } from "@/components/paper-header";
import { QuestionBlock } from "@/components/question-block";
import { getPaper } from "@/lib/data/papers";
import { MODE_LABELS } from "@/lib/engine/generator";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ answers?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const paper = await getPaper(id, false);
  return {
    title: paper ? `${paper.board.name} ${paper.cls.name} ${paper.title}` : "Paper not found",
    robots: { index: false, follow: false },
  };
}

export default async function PaperPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { answers } = await searchParams;
  const showAnswers = answers === "1";
  const paper = await getPaper(id, showAnswers);
  if (!paper) notFound();

  const sections = paper.mode === "EXAM_SIMULATION" ? ["A", "B"] : [""];
  let number = 0;

  return (
    <div className="container-page pt-8 pb-28 sm:pt-10 lg:pb-10">
      <nav aria-label="Breadcrumb" className="no-print mb-4 text-sm text-pencil">
        <Link href="/practice" className="link">
          Build a paper
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{paper.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="min-w-0">
          {paper.hasDemo && (
            <p className="ai-note no-print mb-5 px-4 py-3">
              <strong>Includes AI practice questions.</strong> They were written by AI for practice, have never appeared in an exam and are not previous-year
              questions. Each one is stamped where it appears.
            </p>
          )}
          <article className="sheet sheet-ruled py-6 pr-4 sm:py-10 sm:pr-10">
            <PaperHeader paper={paper} />
            <section aria-label="Instructions" className="mt-5 font-serif text-[1rem]">
              <p className="font-semibold">General instructions</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                <li>Attempt all questions. The marks for each question are shown in brackets [ ].</li>
                {paper.mode === "EXAM_SIMULATION" && <li>Section A has short questions. Section B has longer questions.</li>}
                <li>Show your working for numerical questions.</li>
              </ul>
            </section>

            {sections.map((sec) => {
              const items = paper.items.filter((i) => i.section === sec);
              if (!items.length) return null;
              const secMarks = items.reduce((s, i) => s + i.marks, 0);
              return (
                <section key={sec || "all"} className="mt-8" aria-label={sec ? `Section ${sec}` : "Questions"}>
                  {sec && (
                    <h2 className="mb-5 flex items-baseline justify-between border-b border-rule pb-2 text-[1.25rem]">
                      <span>Section {sec}</span>
                      <span className="marks text-[1rem] font-normal text-pencil">{secMarks} marks</span>
                    </h2>
                  )}
                  <ol className="space-y-7">
                    {items.map((item) => {
                      number++;
                      return (
                        <li key={item.position}>
                          <QuestionBlock number={number} q={item.question} marks={item.marks} showAnswer={showAnswers} headingLevel={sec ? 3 : 2} />
                        </li>
                      );
                    })}
                  </ol>
                </section>
              );
            })}
          </article>
        </div>

        <aside id="paper-actions" className="no-print scroll-mt-24 space-y-5 lg:sticky lg:top-24">
          <div className="sheet p-5">
            <h2 className="font-sans text-[1.05rem] font-bold">What next?</h2>
            <PaperActions paperId={paper.id} showAnswers={showAnswers} />
          </div>
          <div className="sheet p-5">
            <h2 className="font-sans text-[1.05rem] font-bold">About this paper</h2>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.93rem]">
              <dt className="text-pencil">Mode</dt>
              <dd>{MODE_LABELS[paper.mode].name}</dd>
              <dt className="text-pencil">Questions</dt>
              <dd className="num">{paper.items.length}</dd>
              <dt className="text-pencil">Difficulty</dt>
              <dd>{paper.difficulty === "MIXED" ? "Mixed" : paper.difficulty[0] + paper.difficulty.slice(1).toLowerCase()}</dd>
            </dl>
            <div className="mt-4">
              <CompositionBar composition={paper.composition} demo={paper.hasDemo} caption="Where the marks come from" />
            </div>
            {paper.notices.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-rule pt-3 text-[0.9rem] text-pencil">
                {paper.notices.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* On phones the actions sit below the whole paper, so the main one stays in reach. */}
      <div className="mobile-action-bar no-print lg:hidden">
        <Link href={`/test/${paper.id}`} className="btn btn-primary flex-1">
          Start online test
        </Link>
        <a href="#paper-actions" className="btn btn-secondary">
          PDF and more
        </a>
      </div>
    </div>
  );
}
