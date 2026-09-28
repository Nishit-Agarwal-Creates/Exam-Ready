import type { Metadata } from "next";
import Link from "next/link";
import { Pagination } from "@/components/pagination";
import { QuestionBlock } from "@/components/question-block";
import { includeDemoData } from "@/lib/data/papers";
import { searchQuestions, type QuestionFilters } from "@/lib/data/questions";
import { getCatalog } from "@/lib/data/taxonomy";
import { interpretQuery, subjectIdsFor, type IntentChip } from "@/lib/engine/search-intent";
import { filtersToQuery, one, parseQuestionFilters, type SearchParams } from "@/lib/filters";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Search questions",
    description: "Search ICSE and CBSE questions by chapter, topic, year, paper code or wording. Every result shows where it came from.",
    path: "/search",
  }),
  robots: { index: false, follow: true },
};

const EXAMPLES = ["Class 10 CBSE electricity", "ICSE Class 10 quadratic equations", "2026 Science QP 31/2/1", "questions on heredity", "repeated questions chemical reactions"];

const CHIP_STYLE: Record<IntentChip["kind"], string> = {
  board: "border-ink-line bg-ink-soft text-ink-deep",
  class: "border-ink-line bg-ink-soft text-ink-deep",
  subject: "border-ink-line bg-ink-soft text-ink-deep",
  chapter: "border-ink bg-ink text-white",
  year: "border-verified/40 bg-verified-soft text-verified",
  paper: "border-verified/40 bg-verified-soft text-verified",
  question: "border-verified/40 bg-verified-soft text-verified",
  type: "border-rule-strong bg-sheet text-graphite",
  marks: "border-rule-strong bg-sheet text-graphite",
  repeated: "border-margin/40 bg-margin-soft text-margin",
  pyq: "border-verified/40 bg-verified-soft text-verified",
  text: "border-rule-strong bg-sheet text-graphite",
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const manual = parseQuestionFilters(sp);
  const includeDemo = await includeDemoData();
  const catalog = await getCatalog();
  const boards = catalog;
  const classes = boards.flatMap((b) => b.classes.map((c) => ({ ...c, board: b })));
  const subjects = classes.flatMap((c) => c.subjects.map((s) => ({ ...s, cls: c })));
  const source = one(sp.source) || "all";
  const exact = one(sp.exact) === "1";
  const rawQ = manual.q ?? "";

  // Free text is interpreted unless the user asked for the exact words. Explicit filters always win.
  const intent = rawQ && !exact ? interpretQuery(rawQ, catalog) : null;
  const f: QuestionFilters = { ...manual };
  if (intent) {
    f.q = intent.text;
    f.boardId ??= intent.boardId;
    f.classId ??= intent.classId;
    if (!f.classId && intent.classLevel) f.classLevel = intent.classLevel;
    f.subjectId ??= intent.subjectId;
    if (!f.subjectId) {
      const ids = subjectIdsFor(intent, catalog);
      if (ids.length) f.subjectIds = ids;
    }
    f.chapterId ??= intent.chapterId;
    f.year ??= intent.year;
    f.marks ??= intent.marks;
    f.type ??= intent.type;
    f.paperCode = intent.paperCode;
    f.questionNumber = intent.questionNumber;
    if (intent.repeatedOnly) f.repeatedOnly = true;
  }
  const pyqOnly = source === "pyq" || Boolean(intent?.pyqOnly) || Boolean(f.repeatedOnly);
  const hasQuery = Boolean(rawQ || f.subjectId || f.boardId || f.classId || f.year || f.chapterId);
  const result = hasQuery
    ? await searchQuestions(
        {
          ...f,
          realPyqOnly: pyqOnly ? true : undefined,
          sourceType: pyqOnly || source === "all" ? undefined : manual.sourceType,
          publicOnly: true,
          demo: includeDemo ? f.demo : "exclude",
          sort: "recent",
          pageSize: 12,
        },
        false,
      )
    : null;
  const selectedSubject = subjects.find((s) => s.id === f.subjectId);
  const selectedChapter = selectedSubject?.chapters.find((c) => c.id === f.chapterId);
  const chapterHref = selectedSubject && selectedChapter ? `/${selectedSubject.cls.board.slug}/${selectedSubject.cls.slug}/${selectedSubject.slug}/${selectedChapter.slug}` : null;
  const pageHref = (p: number) => `/search${filtersToQuery({ ...manual }, { source, exact: exact ? "1" : undefined, page: p > 1 ? p : undefined })}`;

  return (
    <div className="container-page page-enter py-8 sm:py-12">
      <h1 className="text-[2.2rem] sm:text-[2.8rem]">Search questions</h1>
      <p className="mt-2 max-w-2xl text-pencil">Type the way you&apos;d ask a friend: a chapter, a topic, a year, a paper code or words from the question.</p>

      <form method="get" role="search" className="mt-6">
        <div className="search-hero">
          <label htmlFor="s-q" className="sr-only">
            Search questions
          </label>
          <svg className="search-hero-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id="s-q"
            name="q"
            type="search"
            className="search-hero-input"
            defaultValue={rawQ}
            placeholder="e.g. Class 10 CBSE electricity"
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="submit" className="btn btn-primary search-hero-button" data-fx="pulse">
            Search
          </button>
        </div>

        {!rawQ && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.92rem]">
            <span className="text-pencil">Try</span>
            {EXAMPLES.map((e) => (
              <Link key={e} href={`/search?q=${encodeURIComponent(e)}`} className="chip-link" data-fx="ripple">
                {e}
              </Link>
            ))}
          </p>
        )}

        {intent && intent.chips.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2" aria-live="polite">
            <span className="text-[0.92rem] text-pencil">Searching for</span>
            {intent.chips.map((c, i) => (
              <span key={`${c.kind}-${i}`} className={`intent-chip ${CHIP_STYLE[c.kind]}`} style={{ ["--d" as string]: `${i * 60}ms` }}>
                {c.label}
              </span>
            ))}
            <Link href={`/search?q=${encodeURIComponent(rawQ)}&exact=1`} className="link ml-1 text-[0.9rem]">
              Search the exact words instead
            </Link>
          </div>
        )}

        <details className="panel mt-5 rounded-2xl p-4" open={Boolean(manual.boardId || manual.classId || manual.subjectId || manual.year || source !== "all")}>
          <summary className="cursor-pointer font-bold">More filters</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <label htmlFor="s-board" className="field-label">
                Board
              </label>
              <select id="s-board" name="board" className="select" defaultValue={manual.boardId ?? ""}>
                <option value="">Any</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="s-class" className="field-label">
                Class
              </label>
              <select id="s-class" name="class" className="select" defaultValue={manual.classId ?? ""}>
                <option value="">Any</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.board.name} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="s-subject" className="field-label">
                Subject
              </label>
              <select id="s-subject" name="subject" className="select" defaultValue={manual.subjectId ?? ""}>
                <option value="">Any</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.cls.board.name} {s.cls.name} {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="s-year" className="field-label">
                Exam year
              </label>
              <input id="s-year" name="year" inputMode="numeric" className="input num" defaultValue={manual.year ?? ""} placeholder="2026" />
            </div>
            <div>
              <label htmlFor="s-type" className="field-label">
                Question type
              </label>
              <select id="s-type" name="type" className="select" defaultValue={manual.type ?? ""}>
                <option value="">Any</option>
                <option value="MCQ">MCQ</option>
                <option value="ASSERTION_REASON">Assertion–reason</option>
                <option value="SHORT_ANSWER">Short answer</option>
                <option value="LONG_ANSWER">Long answer</option>
                <option value="CASE_BASED">Case-based</option>
                <option value="NUMERICAL">Numerical</option>
                <option value="FILL_BLANK">Fill in the blank</option>
              </select>
            </div>
            <div>
              <label htmlFor="s-source" className="field-label">
                Source
              </label>
              <select id="s-source" name="source" className="select" defaultValue={source}>
                <option value="all">Everything published</option>
                <option value="pyq">Verified PYQs</option>
                <option value="OFFICIAL_SAMPLE">Official samples</option>
                <option value="USER_CONTRIBUTED">Community</option>
                <option value="AI_SUPPLEMENTARY">AI practice</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="btn btn-secondary btn-sm">
              Apply filters
            </button>
            {hasQuery && (
              <Link href="/search" className="btn btn-ghost btn-sm">
                Clear everything
              </Link>
            )}
          </div>
        </details>
      </form>

      {!result ? (
        <p className="mt-8 max-w-2xl text-pencil">Results show published questions only, each with its source. Questions still awaiting editor review aren&apos;t searchable yet.</p>
      ) : result.items.length === 0 ? (
        <div className="panel mt-6 rounded-2xl p-8 text-center">
          <h2 className="font-sans text-[1.15rem] font-bold">No published questions match yet</h2>
          <p className="mx-auto mt-2 max-w-xl text-pencil">
            {pyqOnly
              ? "No verified previous-year question matches. Official questions for this subject may still be waiting for editor review."
              : "Try fewer words or remove a filter. Questions still awaiting review don't appear in search."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {chapterHref && (
              <Link href={chapterHref} className="btn btn-secondary btn-sm">
                Open the {selectedChapter?.name} chapter page
              </Link>
            )}
            <Link href="/coverage" className="btn btn-ghost btn-sm">
              See what&apos;s covered
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-pencil">
              <strong className="num text-graphite">{result.total}</strong> published result{result.total === 1 ? "" : "s"}
            </p>
            {chapterHref && selectedSubject && (
              <div className="flex flex-wrap gap-2">
                <Link href={chapterHref} className="btn btn-ghost btn-sm">
                  Chapter page
                </Link>
                <Link href={`/practice?subject=${selectedSubject.id}&chapter=${f.chapterId}`} className="btn btn-secondary btn-sm" data-fx="pulse">
                  Build a paper from this chapter
                </Link>
              </div>
            )}
          </div>
          <ol className="mt-3 space-y-4">
            {result.items.map((item, i) => (
              <li key={item.id} className="sheet p-4 sm:p-6">
                <QuestionBlock number={(result.page - 1) * result.pageSize + i + 1} q={item} headingLevel={2} provenance="line" />
              </li>
            ))}
          </ol>
          <Pagination page={result.page} pages={result.pages} href={pageHref} />
        </>
      )}
    </div>
  );
}
