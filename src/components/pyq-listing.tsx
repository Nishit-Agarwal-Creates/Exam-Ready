import Link from "next/link";
import { Pagination } from "@/components/pagination";
import { AnswerKeyText, QuestionBlock } from "@/components/question-block";
import type { ChapterCoverage, SubjectCoverage } from "@/lib/data/coverage";
import type { QuestionView } from "@/lib/data/questions";
import { trendTags } from "@/lib/provenance";

/**
 * Verified previous-year questions for a subject or chapter: one page at a time (10), so a render
 * stays small on the Worker. Only questions that pass the verified-PYQ rule are passed in.
 */
export function PyqListing({
  basePath,
  subjectId,
  chapterId,
  coverage,
  chapters,
  result,
  year,
}: {
  basePath: string;
  subjectId: number;
  chapterId?: number;
  coverage: SubjectCoverage | ChapterCoverage | undefined;
  chapters?: ChapterCoverage[];
  result: { items: QuestionView[]; total: number; page: number; pages: number; pageSize: number };
  year?: number;
}) {
  const years = coverage?.years ?? [];
  const latest = years[0] ?? null;
  const href = (p: { page?: number; year?: number }) => {
    const q = new URLSearchParams();
    if (p.year) q.set("year", String(p.year));
    if (p.page && p.page > 1) q.set("page", String(p.page));
    const s = q.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };
  const practice = `/practice?subject=${subjectId}${chapterId ? `&chapter=${chapterId}` : ""}&mode=PYQ_ONLY`;

  return (
    <>
      {years.length > 0 && (
        <nav aria-label="Exam year" className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-[0.92rem] text-pencil">Exam year</span>
          <Link href={href({})} className={`chip-link ${!year ? "!border-ink !bg-ink !text-white" : ""}`} aria-current={!year ? "page" : undefined}>
            All years
          </Link>
          {years.map((y) => (
            <Link key={y} href={href({ year: y })} className={`chip-link num ${year === y ? "!border-ink !bg-ink !text-white" : ""}`} aria-current={year === y ? "page" : undefined} data-fx="ripple">
              {y}
            </Link>
          ))}
        </nav>
      )}

      {chapters && chapters.some((c) => c.verifiedPyq > 0) && (
        <nav aria-label="Chapters" className="mt-4">
          <ul className="flex flex-wrap gap-2">
            {chapters
              .filter((c) => c.verifiedPyq > 0)
              .sort((a, b) => b.verifiedPyq - a.verifiedPyq)
              .map((c) => (
                <li key={c.chapterId}>
                  <Link href={`${basePath}/${c.slug}`} className="chip-link text-[0.9rem]" data-fx="ripple">
                    {c.name}
                    <span className="num ml-2 rounded-full bg-verified-soft px-1.5 text-[0.78rem] font-bold text-verified">{c.verifiedPyq}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      )}

      {result.items.length === 0 ? (
        <div className="sheet mt-8 max-w-3xl p-6 sm:p-8">
          <h2 className="text-[1.5rem]">No verified previous-year questions {year ? `from ${year} ` : ""}yet</h2>
          <p className="mt-3 text-pencil">
            {coverage && coverage.awaitingPyq > 0
              ? `${coverage.awaitingPyq} questions have been extracted from official board papers and are waiting for an editor to check them against the source. They'll appear here once verified.`
              : "Source collection is in progress. ExamReady doesn't label any question as a PYQ without a verified source."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/practice?subject=${subjectId}${chapterId ? `&chapter=${chapterId}` : ""}`} className="btn btn-primary" data-fx="pulse">
              Practise with labelled questions instead
            </Link>
            <Link href={`/coverage?subject=${subjectId}#chapters`} className="btn btn-secondary">
              See coverage
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <p className="text-pencil">
              <strong className="num text-graphite">{result.total}</strong> verified question{result.total === 1 ? "" : "s"}
              {years.length > 0 && !year ? (
                <>
                  {" "}
                  from <strong className="num text-graphite">{years.length}</strong> exam year{years.length === 1 ? "" : "s"}
                </>
              ) : null}
              {result.pages > 1 ? `, page ${result.page} of ${result.pages}` : ""}
            </p>
            <Link href={practice} className="btn btn-primary btn-sm" data-fx="pulse">
              Build a PYQ-only paper
            </Link>
          </div>
          <ol className="mt-4 space-y-4">
            {result.items.map((q, i) => {
              const tags = trendTags(q, q.groupSources, latest);
              const src = q.sources.find((s) => !s.isDemo && s.paperType === "BOARD_EXAM");
              return (
                <li key={q.id} className="sheet p-4 sm:p-6" data-reveal>
                  <QuestionBlock number={(result.page - 1) * result.pageSize + i + 1} q={q} headingLevel={2} provenance="line" />
                  <div className="mt-3 flex flex-wrap items-center gap-2 sm:ml-[3.25rem]">
                    {tags.map((t) => (
                      <span key={t} className="rounded-full border border-verified/30 bg-verified-soft/60 px-2 py-0.5 text-[0.8rem] font-bold text-verified">
                        {t}
                      </span>
                    ))}
                  </div>
                  <details className="mt-3 sm:ml-[3.25rem]">
                    <summary className="inline-flex min-h-9 cursor-pointer items-center font-bold text-ink hover:underline">Show answer</summary>
                    <div className="mt-2">
                      <AnswerKeyText q={q} />
                    </div>
                  </details>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.9rem] sm:ml-[3.25rem]">
                    <Link href={`/questions/${q.id}`} className="link">
                      View question
                    </Link>
                    {src && (
                      <Link href={`/sources/${src.paperId}`} className="link">
                        View source
                      </Link>
                    )}
                    <Link href={`/questions/${q.id}#similar`} className="link">
                      Find similar
                    </Link>
                    <Link href={`/practice?subject=${subjectId}&chapter=${q.chapter.id}&mode=PYQ_ONLY`} className="link">
                      Practise this chapter
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
          <Pagination page={result.page} pages={result.pages} href={(p) => href({ page: p, year })} />
        </>
      )}
    </>
  );
}
