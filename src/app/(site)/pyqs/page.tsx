import type { Metadata } from "next";
import Link from "next/link";
import { Pagination } from "@/components/pagination";
import { AnswerKeyText, QuestionBlock, TYPE_NAMES } from "@/components/question-block";
import { QUESTION_TYPES, SOURCE_TYPES } from "@/db/schema";
import { searchQuestions } from "@/lib/data/questions";
import { includeDemoData } from "@/lib/data/papers";
import { getCatalog } from "@/lib/data/taxonomy";
import { filtersToQuery, parseQuestionFilters, type SearchParams } from "@/lib/filters";
import { SOURCE_LABELS } from "@/lib/provenance";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "ICSE previous-year questions and question bank",
  description:
    "Browse ICSE Class 8, 9 and 10 questions by chapter, type and source. Every question shows whether it is a verified previous-year question, an official sample, contributed or AI-generated.",
  path: "/pyqs",
});

export default async function PyqsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const f = parseQuestionFilters(sp);
  const includeDemo = await includeDemoData();
  const catalog = await getCatalog();
  const subjectsFlat = catalog.flatMap((b) => b.classes.flatMap((c) => c.subjects.map((s) => ({ ...s, cls: c, board: b }))));
  const selected = subjectsFlat.find((s) => s.id === f.subjectId);
  // A chapter only applies when it belongs to the chosen subject.
  if (f.chapterId && !selected?.chapters.some((c) => c.id === f.chapterId)) f.chapterId = undefined;
  const [result, realPyq] = await Promise.all([
    searchQuestions({ ...f, publicOnly: true, demo: includeDemo ? f.demo : "exclude", pageSize: 15 }, true),
    searchQuestions({ sourceType: "VERIFIED_PYQ", demo: "exclude", publicOnly: true, pageSize: 1 }, false),
  ]);
  const hasFilters = Boolean(f.subjectId || f.sourceType || f.type || f.difficulty || f.q || f.chapterId);

  return (
    <div className="container-page py-8 sm:py-12">
      <header className="max-w-3xl">
        <h1 className="text-[2.2rem] sm:text-[2.8rem]">Previous-year questions and question bank</h1>
        <p className="mt-3 text-[1.08rem] text-pencil">
          Filter by class, chapter and source. Only questions stamped Verified PYQ are claimed to come from a past board paper, and each one lists that paper.
        </p>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <p className="panel px-4 py-3">
          <span className="block text-sm text-pencil">Verified previous-year questions published</span>
          <span className="num font-serif text-[1.6rem] font-semibold">{realPyq.total}</span>
        </p>
        <p className="panel px-4 py-3">
          <span className="block text-sm text-pencil">Questions matching your filters</span>
          <span className="num font-serif text-[1.6rem] font-semibold">{result.total}</span>
        </p>
      </div>
      {realPyq.total === 0 && (
        <p className="demo-banner mt-4 px-4 py-3 font-bold">
          No real verified previous-year questions have been published yet. The questions below are demo data, written to show how ExamReady works.
        </p>
      )}

      <form method="get" className="panel mt-6 grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4" aria-label="Filter questions">
        <div>
          <label htmlFor="f-subject" className="field-label">
            Class and subject
          </label>
          <select id="f-subject" name="subject" className="select" defaultValue={f.subjectId ?? ""}>
            <option value="">All subjects</option>
            {catalog.flatMap((b) =>
              b.classes.map((c) => (
                <optgroup key={c.id} label={`${b.name} ${c.name}`}>
                  {c.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {c.name} {s.name}
                    </option>
                  ))}
                </optgroup>
              )),
            )}
          </select>
        </div>
        <div>
          <label htmlFor="f-chapter" className="field-label">
            Chapter
          </label>
          <select id="f-chapter" name="chapter" className="select" defaultValue={f.chapterId ?? ""} disabled={!selected}>
            <option value="">{selected ? "All chapters" : "Choose a subject first"}</option>
            {selected?.chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-source" className="field-label">
            Source
          </label>
          <select id="f-source" name="source" className="select" defaultValue={f.sourceType ?? ""}>
            <option value="">All sources</option>
            {SOURCE_TYPES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s].short}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-type" className="field-label">
            Question type
          </label>
          <select id="f-type" name="type" className="select" defaultValue={f.type ?? ""}>
            <option value="">All types</option>
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_NAMES[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="f-q" className="field-label">
            Search question text
          </label>
          <input id="f-q" name="q" type="search" className="input" defaultValue={f.q ?? ""} placeholder="e.g. valency, refraction, quadratic…" />
        </div>
        <div>
          <label htmlFor="f-diff" className="field-label">
            Difficulty
          </label>
          <select id="f-diff" name="difficulty" className="select" defaultValue={f.difficulty ?? ""}>
            <option value="">Any</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="btn btn-primary flex-1">
            Apply filters
          </button>
          {hasFilters && (
            <Link href="/pyqs" className="btn btn-ghost">
              Reset
            </Link>
          )}
        </div>
      </form>

      {selected && (
        <p className="mt-4 text-[0.95rem]">
          <Link href={`/${selected.board.slug}/${selected.cls.slug}/${selected.slug}`} className="link font-bold">
            {selected.board.name} {selected.cls.name} {selected.name} overview
          </Link>
          <span className="text-pencil"> or </span>
          <Link href={`/practice?subject=${selected.id}${f.chapterId ? `&chapter=${f.chapterId}` : ""}`} className="link font-bold">
            build a paper from these questions
          </Link>
        </p>
      )}

      {result.items.length === 0 ? (
        <div className="panel mt-6 p-8 text-center">
          <h2 className="font-sans text-[1.15rem] font-bold">No questions match these filters</h2>
          <p className="mt-2 text-pencil">
            {f.sourceType === "VERIFIED_PYQ" ? "There are no verified previous-year questions for this selection yet. " : ""}
            Try removing a filter or choosing another chapter.
          </p>
          <Link href="/pyqs" className="btn btn-secondary mt-4">
            Clear all filters
          </Link>
        </div>
      ) : (
        <ol className="mt-6 space-y-4" start={(result.page - 1) * result.pageSize + 1}>
          {result.items.map((q, i) => (
            <li key={q.id} className="sheet p-4 sm:p-6">
              <QuestionBlock number={(result.page - 1) * result.pageSize + i + 1} q={q} headingLevel={2} />
              {q.answer && (
                <details className="mt-3 sm:ml-[3.25rem]">
                  <summary className="inline-flex min-h-9 cursor-pointer items-center font-bold text-ink hover:underline">Show answer</summary>
                  <div className="mt-2">
                    <AnswerKeyText q={q} />
                  </div>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
      <Pagination page={result.page} pages={result.pages} href={(p) => `/pyqs${filtersToQuery(f, { page: p > 1 ? p : undefined })}`} />
    </div>
  );
}
