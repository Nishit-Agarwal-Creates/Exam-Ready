import type { Metadata } from "next";
import Link from "next/link";
import { Pagination } from "@/components/pagination";
import { QuestionBlock } from "@/components/question-block";
import { includeDemoData } from "@/lib/data/papers";
import { searchQuestions } from "@/lib/data/questions";
import { getCatalog } from "@/lib/data/taxonomy";
import { filtersToQuery, one, parseQuestionFilters, type SearchParams } from "@/lib/filters";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Search questions",
    description: "Search ICSE and CBSE questions by text, board, class, subject, chapter, year and source. Every result shows where it came from.",
    path: "/search",
  }),
  robots: { index: false, follow: true },
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const f = parseQuestionFilters(sp);
  const includeDemo = await includeDemoData();
  const catalog = await getCatalog();
  const boards = catalog;
  const classes = boards.flatMap((b) => b.classes.map((c) => ({ ...c, board: b })));
  const subjects = classes.flatMap((c) => c.subjects.map((s) => ({ ...s, cls: c })));
  const source = one(sp.source) || "all";
  const hasQuery = Boolean(f.q || f.subjectId || f.boardId || f.classId || f.year || f.chapterId);
  const result = hasQuery
    ? await searchQuestions(
        {
          ...f,
          realPyqOnly: source === "pyq" ? true : undefined,
          sourceType: source === "pyq" || source === "all" ? undefined : f.sourceType,
          publicOnly: true,
          demo: includeDemo ? f.demo : "exclude",
          sort: "recent",
          pageSize: 20,
        },
        false,
      )
    : null;
  const selectedSubject = subjects.find((s) => s.id === f.subjectId);

  return (
    <div className="container-page page-enter py-8 sm:py-12">
      <h1 className="text-[2.2rem] sm:text-[2.8rem]">Search questions</h1>
      <form method="get" role="search" className="panel mt-6 grid gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2 lg:col-span-6">
          <label htmlFor="s-q" className="field-label">
            Question text or question number
          </label>
          <input id="s-q" name="q" type="search" className="input text-[1.05rem]" defaultValue={f.q ?? ""} placeholder="e.g. Ohm's law, ozone layer, 31/2/1…" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="s-board" className="field-label">
            Board
          </label>
          <select id="s-board" name="board" className="select" defaultValue={f.boardId ?? ""}>
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
          <select id="s-class" name="class" className="select" defaultValue={f.classId ?? ""}>
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
          <select id="s-subject" name="subject" className="select" defaultValue={f.subjectId ?? ""}>
            <option value="">Any</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.cls.board.name} {s.cls.name} {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="s-chapter" className="field-label">
            Chapter
          </label>
          <select id="s-chapter" name="chapter" className="select" defaultValue={f.chapterId ?? ""} disabled={!selectedSubject}>
            <option value="">{selectedSubject ? "Any" : "Choose a subject"}</option>
            {selectedSubject?.chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="s-year" className="field-label">
            Exam year
          </label>
          <input id="s-year" name="year" inputMode="numeric" className="input num" defaultValue={f.year ?? ""} placeholder="2026" />
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
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className="btn btn-primary">
            Search
          </button>
          {hasQuery && (
            <Link href="/search" className="btn btn-ghost">
              Clear
            </Link>
          )}
        </div>
      </form>

      {!result ? (
        <p className="mt-8 text-pencil">Type some words from a question, or choose a board, class or subject. Results show only published questions, each with its source.</p>
      ) : result.items.length === 0 ? (
        <div className="panel mt-6 rounded-2xl p-8 text-center">
          <h2 className="font-sans text-[1.15rem] font-bold">No published questions match</h2>
          <p className="mt-2 text-pencil">Try fewer words or remove a filter. Questions still awaiting review don&apos;t appear in search.</p>
        </div>
      ) : (
        <>
          <p className="mt-6 text-pencil">
            <strong className="num text-graphite">{result.total}</strong> result{result.total === 1 ? "" : "s"}
          </p>
          <ol className="mt-3 space-y-4">
            {result.items.map((item, i) => (
              <li key={item.id} className="sheet p-4 sm:p-6">
                <QuestionBlock number={(result.page - 1) * result.pageSize + i + 1} q={item} headingLevel={2} />
              </li>
            ))}
          </ol>
          <Pagination page={result.page} pages={result.pages} href={(p) => `/search${filtersToQuery(f, { source, page: p > 1 ? p : undefined })}`} />
        </>
      )}
    </div>
  );
}
