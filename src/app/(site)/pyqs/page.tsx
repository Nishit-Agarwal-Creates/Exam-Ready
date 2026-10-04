import type { Metadata } from "next";
import Link from "next/link";
import { FilterDrawer } from "@/components/filter-drawer";
import { Pagination } from "@/components/pagination";
import { ListAnswer, QuestionBlock, TYPE_NAMES } from "@/components/question-block";
import { QUESTION_TYPES } from "@/db/schema";
import { includeDemoData } from "@/lib/data/papers";
import { searchQuestions } from "@/lib/data/questions";
import { getCatalog } from "@/lib/data/taxonomy";
import { getSubjectYearCoverage } from "@/lib/data/coverage";
import { getAllCoverage, getPublicSources } from "@/lib/data/trends";
import { filtersToQuery, parseQuestionFilters, type SearchParams } from "@/lib/filters";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "PYQ explorer: previous-year questions by board, class, subject and year",
  description:
    "Explore ICSE and CBSE previous-year questions by class, subject, year and paper. Every question shows the official paper, question number and page it came from.",
  path: "/pyqs",
});

const SOURCES = [
  ["pyq", "Verified PYQs"],
  ["OFFICIAL_SAMPLE", "Official samples"],
  ["USER_CONTRIBUTED", "Community"],
  ["AI_SUPPLEMENTARY", "AI practice"],
  ["all", "Everything published"],
] as const;

export default async function PyqExplorer({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const f = parseQuestionFilters(sp);
  const catalog = await getCatalog();
  const subjects = catalog.flatMap((b) => b.classes.flatMap((c) => c.subjects.map((s) => ({ ...s, cls: c, board: b }))));
  const selected = subjects.find((s) => s.id === f.subjectId);

  // No subject chosen: board → class → subject picker with honest availability.
  if (!selected) {
    const coverage = await getAllCoverage();
    const boardSlug = String(sp.b ?? catalog[0]?.slug ?? "");
    const board = catalog.find((b) => b.slug === boardSlug) ?? catalog[0];
    return (
      <div className="container-page page-enter py-8 sm:py-12">
        <header className="max-w-3xl">
          <h1 className="text-[2.2rem] sm:text-[2.8rem]">PYQ explorer</h1>
          <p className="mt-3 text-[1.08rem] text-pencil">
            Choose a board, class and subject. Each subject shows how many verified previous-year questions exist and which exam years they cover.
          </p>
        </header>
        <nav aria-label="Board" className="mt-6 inline-flex rounded-full border border-rule bg-sheet p-1">
          {catalog.map((b) => (
            <Link
              key={b.slug}
              href={`/pyqs?b=${b.slug}`}
              aria-current={b.slug === board?.slug ? "page" : undefined}
              className={`min-h-10 rounded-full px-5 py-2 font-bold ${b.slug === board?.slug ? "bg-night text-white" : "text-pencil hover:text-graphite"}`}
            >
              {b.name}
            </Link>
          ))}
        </nav>
        <div className="mt-8 space-y-8">
          {board?.classes
            .slice()
            .reverse()
            .map((c) => (
              <section key={c.id} aria-labelledby={`cls-${c.id}`} data-reveal>
                <h2 id={`cls-${c.id}`} className="text-[1.5rem]">
                  {board.name} {c.name}
                </h2>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {c.subjects.map((s) => {
                    const cov = coverage.find((r) => r.subjectId === s.id);
                    return (
                      <li key={s.id}>
                        <Link href={`/pyqs?subject=${s.id}`} className="tilt-card flex h-full flex-col rounded-2xl border border-rule bg-sheet p-4">
                          <span className="font-bold">{s.name}</span>
                          {cov && cov.verified > 0 ? (
                            <>
                              <span className="mt-1 text-[0.92rem] font-bold text-verified">{cov.verified} verified PYQs</span>
                              <span className="mt-auto pt-2 text-[0.85rem] text-pencil">Years: {cov.years.join(", ")}</span>
                            </>
                          ) : cov && cov.authentic > 0 ? (
                            <span className="mt-1 text-[0.92rem] font-bold text-verified">
                              {cov.authentic} verified questions from specimens, question banks and school exams
                            </span>
                          ) : cov && cov.pending > 0 ? (
                            <span className="mt-1 text-[0.92rem] text-pending">
                              {cov.pending} extracted from {cov.pendingYears.join(", ")} papers, awaiting review
                            </span>
                          ) : (
                            <span className="mt-1 text-[0.92rem] text-pencil">Verified PYQs are not yet available.</span>
                          )}
                          {cov && cov.aiPractice > 0 && <span className="mt-1 text-[0.82rem] text-ai">{cov.aiPractice} AI practice questions</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
        </div>
      </div>
    );
  }

  // Subject chosen.
  const includeDemo = await includeDemoData();
  if (f.chapterId && !selected.chapters.some((c) => c.id === f.chapterId)) f.chapterId = undefined;
  // Subjects without board-exam PYQs (most ICSE classes below 10, ISC 11) open on everything verified instead of an empty list.
  const subjectCoverage = await getSubjectYearCoverage(selected.id);
  const sourceParam = String(sp.source ?? (subjectCoverage.verifiedPyqs > 0 ? "pyq" : "all"));
  const filters = {
    ...f,
    subjectId: selected.id,
    realPyqOnly: sourceParam === "pyq" ? true : undefined,
    sourceType: sourceParam === "pyq" || sourceParam === "all" ? undefined : f.sourceType,
    publicOnly: true,
    // One card per duplicate group (the same question in several sets), so counts match the PYQ hubs.
    groupOnce: true,
    demo: includeDemo ? f.demo : ("exclude" as const),
    sort: "recent" as const,
    pageSize: 10,
  };
  const [result, coverage, sources] = await Promise.all([
    searchQuestions(filters, true, { cachedIds: true }),
    subjectCoverage,
    getPublicSources(),
  ]);
  const subjectSources = sources.filter((s) => s.board === selected.board.name && s.cls === selected.cls.name && s.subject === selected.name);
  const base = `/pyqs?subject=${selected.id}`;
  const q = (o: Record<string, string | number | undefined>) => `/pyqs${filtersToQuery({ ...f, subjectId: selected.id }, { source: sourceParam, page: undefined, ...o })}`;
  // Filters set in the form, shown as removable chips above the results (year and paper have their own rows above).
  const chapterName = selected.chapters.find((c) => c.id === f.chapterId)?.name;
  const active = [
    f.q && { label: `“${f.q}”`, href: q({ q: undefined }) },
    sourceParam !== "pyq" && { label: SOURCES.find(([v]) => v === sourceParam)?.[1] ?? sourceParam, href: q({ source: "pyq" }) },
    chapterName && { label: chapterName, href: q({ chapter: undefined }) },
    f.type && { label: TYPE_NAMES[f.type], href: q({ type: undefined }) },
    f.marks && { label: `${f.marks} mark${f.marks === 1 ? "" : "s"}`, href: q({ marks: undefined }) },
    f.difficulty && sourceParam !== "pyq" && { label: f.difficulty[0] + f.difficulty.slice(1).toLowerCase(), href: q({ difficulty: undefined }) },
    f.repeatedOnly && { label: "Asked in 2+ years", href: q({ repeated: undefined }) },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="container-page page-enter py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-pencil">
        <Link href={`/pyqs?b=${selected.board.slug}`} className="link">
          PYQ explorer
        </Link>
        <span aria-hidden="true"> / </span>
        <span>
          {selected.board.name} {selected.cls.name} {selected.name}
        </span>
      </nav>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[2rem] sm:text-[2.6rem]">
            {selected.board.name} {selected.cls.name} {selected.name}
          </h1>
          <p className="mt-2 text-pencil">
            {coverage.verifiedPyqs > 0
              ? `${coverage.verifiedPyqs} verified previous-year questions.`
              : "Verified previous-year questions are not yet available for this subject."}
            {coverage.pendingPyqs > 0 ? ` ${coverage.pendingPyqs} more are extracted from official papers and awaiting review.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/practice?subject=${selected.id}`} className="btn btn-primary" data-magnetic>
            Build a paper from these
          </Link>
          <Link href={`/${selected.board.slug}/${selected.cls.slug}/${selected.slug}`} className="btn btn-secondary">
            Subject overview
          </Link>
        </div>
      </header>

      {/* Year coverage */}
      <section aria-labelledby="years-title" className="mt-6">
        <h2 id="years-title" className="sr-only">
          Exam years
        </h2>
        <ul className="chip-scroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <li className="shrink-0">
            <Link href={q({ year: undefined })} className={`inline-flex min-h-10 items-center rounded-full border px-4 font-bold ${!f.year ? "border-night bg-night text-white" : "border-rule bg-sheet"}`}>
              All years
            </Link>
          </li>
          {coverage.byYear.map((y) => (
            <li key={y.year} className="shrink-0">
              <Link
                href={q({ year: y.year })}
                aria-current={f.year === y.year ? "true" : undefined}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 font-bold ${f.year === y.year ? "border-night bg-night text-white" : "border-rule bg-sheet"}`}
              >
                {y.year}
                <span className={`text-[0.8rem] font-normal ${f.year === y.year ? "text-white/75" : "text-pencil"}`}>
                  {y.verified} verified{y.pending ? `, ${y.pending} pending` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Papers */}
      {subjectSources.length > 0 && (
        <section aria-labelledby="papers-title" className="mt-6">
          <h2 id="papers-title" className="font-sans text-[1rem] font-bold text-pencil">
            Papers in the bank
          </h2>
          <ul className="mt-2 grid gap-2 md:grid-cols-3">
            {subjectSources.map((s) => (
              <li key={s.id}>
                <Link
                  href={q({ paper: f.paperId === s.id ? undefined : s.id })}
                  aria-current={f.paperId === s.id ? "true" : undefined}
                  className={`tilt-card block rounded-2xl border p-3 ${f.paperId === s.id ? "border-ink bg-ink-soft" : "border-rule bg-sheet"}`}
                >
                  <span className="block font-bold">
                    {s.year} {s.paper_code ? `Q.P. ${s.paper_code}` : ""}
                  </span>
                  <span className="text-[0.85rem] text-pencil">
                    {s.verified} verified of {s.extracted} extracted
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6">
      <FilterDrawer count={active.length}>
      <form method="get" className="panel grid gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-6" aria-label="Filter questions">
        <input type="hidden" name="subject" value={selected.id} />
        {f.year && <input type="hidden" name="year" value={f.year} />}
        {f.paperId && <input type="hidden" name="paper" value={f.paperId} />}
        <div className="lg:col-span-2">
          <label htmlFor="f-q" className="field-label">
            Search text
          </label>
          <input id="f-q" name="q" type="search" className="input" defaultValue={f.q ?? ""} placeholder="e.g. refraction, ozone, Ohm…" />
        </div>
        <div>
          <label htmlFor="f-source" className="field-label">
            Source
          </label>
          <select id="f-source" name="source" className="select" defaultValue={sourceParam}>
            {SOURCES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-chapter" className="field-label">
            Chapter
          </label>
          <select id="f-chapter" name="chapter" className="select" defaultValue={f.chapterId ?? ""}>
            <option value="">All chapters</option>
            {selected.chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-type" className="field-label">
            Type
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
        <div>
          <label htmlFor="f-marks" className="field-label">
            Marks
          </label>
          <select id="f-marks" name="marks" className="select" defaultValue={f.marks ?? ""}>
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map((m) => (
              <option key={m} value={m}>
                {m} mark{m === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </div>
        {sourceParam !== "pyq" && (
        <div>
          <label htmlFor="f-difficulty" className="field-label">
            Difficulty
          </label>
          <select id="f-difficulty" name="difficulty" className="select" defaultValue={f.difficulty ?? ""} aria-describedby="f-difficulty-hint">
            <option value="">Any</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
          <p id="f-difficulty-hint" className="field-hint mt-1">
            Practice questions only. Board papers don&apos;t rate difficulty.
          </p>
        </div>
        )}
        <label className="flex items-center gap-2 font-bold lg:col-span-2">
          <input type="checkbox" name="repeated" value="1" defaultChecked={f.repeatedOnly} className="size-5 accent-[var(--color-ink)]" />
          Only questions asked in more than one exam year
        </label>
        <div className="flex items-end gap-2 lg:col-span-3 lg:justify-end">
          <button type="submit" className="btn btn-primary">
            Apply filters
          </button>
          <Link href={base} className="btn btn-ghost">
            Reset
          </Link>
        </div>
      </form>
      </FilterDrawer>
      </div>

      {active.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Active filters">
          {active.map((a) => (
            <li key={a.href}>
              <span className="intent-chip">
                {a.label}
                <Link href={a.href} className="intent-chip-remove" aria-label={`Remove filter: ${a.label}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </Link>
              </span>
            </li>
          ))}
          <li>
            <Link href={base} className="btn btn-ghost btn-sm">
              Clear all
            </Link>
          </li>
        </ul>
      )}

      <p className="mt-4 text-pencil">
        <strong className="num text-graphite">{result.total}</strong> question{result.total === 1 ? "" : "s"}
        {f.year ? ` from ${f.year}` : ""}, most recent first.
      </p>

      {result.items.length === 0 ? (
        <div className="panel mt-4 rounded-2xl p-8 text-center">
          <h2 className="font-sans text-[1.15rem] font-bold">
            {sourceParam === "pyq" ? "No verified previous-year questions match yet" : "No questions match these filters"}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-pencil">
            {sourceParam === "pyq" && coverage.pendingPyqs > 0
              ? `${coverage.pendingPyqs} questions from official papers are waiting for an editor to verify them. They'll appear here once they're checked against the source.`
              : f.repeatedOnly
                ? "No verified question in this subject has appeared in more than one exam year yet."
                : "Try another year, chapter or source."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {sourceParam === "pyq" && (
              <Link href={q({ source: "all", repeated: undefined })} className="btn btn-secondary">
                Show everything published
              </Link>
            )}
            <Link href={base} className="btn btn-ghost">
              Clear filters
            </Link>
          </div>
        </div>
      ) : (
        <ol className="mt-4 space-y-4">
          {result.items.map((item, i) => (
            <li key={item.id} data-reveal className="sheet p-4 sm:p-6" style={{ ["--d" as string]: `${Math.min(i, 6) * 40}ms` }}>
              <QuestionBlock number={(result.page - 1) * result.pageSize + i + 1} q={item} headingLevel={2} provenance="line" />
              <ListAnswer q={item} />
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.9rem] sm:ml-[3.25rem] [&>a]:inline-flex [&>a]:min-h-6 [&>a]:items-center">
                <Link href={`/questions/${item.id}`} className="link">
                  View question
                </Link>
                {item.sources.find((s) => !s.isDemo) && (
                  <Link href={`/sources/${item.sources.find((s) => !s.isDemo)!.paperId}`} className="link">
                    View source
                  </Link>
                )}
                <Link href={`/questions/${item.id}#similar`} className="link">
                  Find similar
                </Link>
                <Link href={`/practice?subject=${selected.id}&chapter=${item.chapter.id}`} className="link">
                  Practise this chapter
                </Link>
              </div>
            </li>
          ))}
        </ol>
      )}
      <Pagination page={result.page} pages={result.pages} href={(p) => `/pyqs${filtersToQuery({ ...f, subjectId: selected.id }, { source: sourceParam, page: p > 1 ? p : undefined })}`} />
    </div>
  );
}
