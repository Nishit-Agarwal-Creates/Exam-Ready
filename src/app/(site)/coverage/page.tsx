import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { getBankTotals, getChapterCoverage, getSubjectCoverage, type CoverageCounts, type SubjectCoverage } from "@/lib/data/coverage";
import { one, type SearchParams } from "@/lib/filters";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Question coverage by board, class, subject and chapter",
  description:
    "What ExamReady actually has, counted live from the database: verified previous-year questions, official sample questions, AI practice and source papers for every ICSE and CBSE subject.",
  path: "/coverage",
});

function Cell({ n, tone }: { n: number; tone: "verified" | "official" | "ai" | "pending" }) {
  if (!n) return <span className="text-pencil/60">0</span>;
  const cls = { verified: "text-verified", official: "text-official", ai: "text-ai", pending: "text-pending" }[tone];
  return <span className={`num font-bold ${cls}`}>{n}</span>;
}

function yearsText(c: CoverageCounts) {
  if (c.years.length) return c.years.length > 3 ? `${c.years[c.years.length - 1]}–${c.years[0]} (${c.years.length} years)` : c.years.join(", ");
  if (c.pendingYears.length) return `${c.pendingYears.join(", ")} (awaiting review)`;
  return "—";
}

function status(r: SubjectCoverage) {
  if (r.verifiedPyq > 0) return { label: "Verified PYQs available", cls: "stamp-verified" };
  if (r.officialSample > 0) return { label: "Official samples available", cls: "stamp-official" };
  if (r.awaitingReview > 0) return { label: "Sources awaiting review", cls: "stamp-pending" };
  if (r.aiPractice > 0) return { label: "AI practice only", cls: "stamp-ai" };
  return { label: "Source collection in progress", cls: "stamp-pending" };
}

export default async function CoveragePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [rows, totals] = await Promise.all([getSubjectCoverage(), getBankTotals()]);
  const boards = [...new Map(rows.map((r) => [r.boardSlug, r.boardName])).entries()];
  const boardSlug = boards.some(([b]) => b === one(sp.board)) ? one(sp.board) : (boards[0]?.[0] ?? "");
  const subjectId = Number(one(sp.subject)) || null;
  const selected = subjectId ? rows.find((r) => r.subjectId === subjectId) : undefined;
  const chapters = selected ? await getChapterCoverage(selected.subjectId) : [];
  const boardRows = rows.filter((r) => r.boardSlug === boardSlug);
  const classes = [...new Map(boardRows.map((r) => [r.classId, r])).values()];

  return (
    <div className="container-page page-enter py-8 sm:py-12">
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Coverage", path: "/coverage" },
        ]}
      />
      <header className="max-w-3xl">
        <h1 className="text-[2.2rem] sm:text-[2.8rem]">What&apos;s in the bank</h1>
        <p className="mt-3 text-[1.08rem] text-pencil">
          Counted live from the database. A question is counted as a verified PYQ only after an editor has checked it against the official paper; the
          same question in several sets counts once. Where nothing is available yet, it says so.
        </p>
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Verified PYQs", totals.verifiedPyq, "text-verified"],
          ["Official sample questions", totals.officialSample, "text-official"],
          ["AI practice questions", totals.aiPractice, "text-ai"],
          ["Awaiting editor review", totals.awaitingReview, "text-pending"],
          ["Source documents", totals.sources, "text-ink"],
        ].map(([label, n, cls]) => (
          <div key={label as string} className="panel rounded-2xl p-4">
            <dt className="text-[0.88rem] text-pencil">{label}</dt>
            <dd className={`num mt-1 font-serif text-[2rem] font-semibold ${cls}`}>{n as number}</dd>
          </div>
        ))}
      </dl>

      <div role="tablist" aria-label="Board" className="mt-10 inline-flex rounded-full border border-rule bg-sheet p-1">
        {boards.map(([slug, name]) => (
          <Link
            key={slug}
            role="tab"
            aria-selected={slug === boardSlug}
            href={`/coverage?board=${slug}`}
            className={`inline-flex min-h-11 items-center rounded-full px-5 font-bold ${slug === boardSlug ? "bg-night text-white" : "text-pencil hover:text-graphite"}`}
          >
            {name}
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-8">
        {classes.map((c) => {
          const subs = boardRows.filter((r) => r.classId === c.classId);
          return (
            <section key={c.classId} aria-labelledby={`cov-${c.classId}`}>
              <h2 id={`cov-${c.classId}`} className="text-[1.5rem]">
                <span className="numeral-roll">{c.className}</span>
              </h2>
              <div className="panel mt-3 rounded-2xl sm:overflow-x-auto">
                <table className="table table-stack sm:min-w-[46rem]">
                  <thead>
                    <tr>
                      <th scope="col">Subject</th>
                      <th scope="col" className="text-right">
                        Verified PYQs
                      </th>
                      <th scope="col" className="text-right">
                        Official sample
                      </th>
                      <th scope="col" className="text-right">
                        AI practice
                      </th>
                      <th scope="col" className="text-right">
                        Awaiting review
                      </th>
                      <th scope="col">Exam years</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.map((r) => {
                      const st = status(r);
                      return (
                        <tr key={r.subjectId} className={r.subjectId === subjectId ? "bg-ink-soft/50" : undefined}>
                          <th scope="row" className="!text-[0.95rem] !font-bold !text-graphite">
                            <Link href={`/coverage?board=${boardSlug}&subject=${r.subjectId}#chapters`} className="hover:underline">
                              {r.subjectName}
                            </Link>
                            <span className="block text-[0.8rem] font-normal text-pencil">
                              {r.chapterCount ? `${r.chapterCount} chapters` : "Chapter list not added yet"}
                              {r.sourcePapers.boardExam + r.sourcePapers.sample > 0
                                ? ` · ${r.sourcePapers.boardExam} board paper${r.sourcePapers.boardExam === 1 ? "" : "s"}, ${r.sourcePapers.sample} sample/specimen`
                                : ""}
                            </span>
                          </th>
                          <td className="text-right" data-label="Verified PYQs">
                            <Cell n={r.verifiedPyq} tone="verified" />
                          </td>
                          <td className="text-right" data-label="Official sample">
                            <Cell n={r.officialSample} tone="official" />
                          </td>
                          <td className="text-right" data-label="AI practice">
                            <Cell n={r.aiPractice} tone="ai" />
                          </td>
                          <td className="text-right" data-label="Awaiting review">
                            <Cell n={r.awaitingReview} tone="pending" />
                          </td>
                          <td className="text-[0.9rem]" data-label="Exam years">
                            {yearsText(r)}
                          </td>
                          <td data-label="Status">
                            <span className={`stamp ${st.cls}`}>{st.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      {selected && (
        <section id="chapters" aria-labelledby="chapters-title" className="mt-12 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="chapters-title" className="text-[1.8rem]">
              {selected.boardName} {selected.className} {selected.subjectName}, by chapter
            </h2>
            <div className="flex flex-wrap gap-2">
              <Link href={`/${selected.boardSlug}/${selected.classSlug}/${selected.subjectSlug}`} className="btn btn-secondary btn-sm">
                Subject page
              </Link>
              <Link href={`/practice?subject=${selected.subjectId}`} className="btn btn-primary btn-sm" data-fx="pulse">
                Build a {selected.subjectName} paper
              </Link>
            </div>
          </div>
          {chapters.length === 0 ? (
            <p className="panel mt-4 rounded-2xl p-6 text-pencil">
              The chapter list for this subject hasn&apos;t been added yet, so coverage can&apos;t be shown by chapter. Source collection is in progress.
            </p>
          ) : (
            <div className="panel mt-4 rounded-2xl sm:overflow-x-auto">
              <table className="table table-stack sm:min-w-[40rem]">
                <thead>
                  <tr>
                    <th scope="col">Chapter</th>
                    <th scope="col" className="text-right">
                      Verified PYQs
                    </th>
                    <th scope="col" className="text-right">
                      Official sample
                    </th>
                    <th scope="col" className="text-right">
                      AI practice
                    </th>
                    <th scope="col" className="text-right">
                      Awaiting review
                    </th>
                    <th scope="col">Verified exam years</th>
                  </tr>
                </thead>
                <tbody>
                  {chapters.map((ch) => (
                    <tr key={ch.chapterId}>
                      <th scope="row" className="!text-[0.95rem] !font-semibold !text-graphite">
                        <Link href={`/${selected.boardSlug}/${selected.classSlug}/${selected.subjectSlug}/${ch.slug}`} className="hover:underline">
                          {ch.name}
                        </Link>
                      </th>
                      <td className="text-right" data-label="Verified PYQs">
                        <Cell n={ch.verifiedPyq} tone="verified" />
                      </td>
                      <td className="text-right" data-label="Official sample">
                        <Cell n={ch.officialSample} tone="official" />
                      </td>
                      <td className="text-right" data-label="AI practice">
                        <Cell n={ch.aiPractice} tone="ai" />
                      </td>
                      <td className="text-right" data-label="Awaiting review">
                        <Cell n={ch.awaitingReview} tone="pending" />
                      </td>
                      <td className="text-[0.9rem]" data-label="Verified exam years">
                        {yearsText(ch)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[0.9rem] text-pencil">
            &ldquo;Awaiting review&rdquo; questions were extracted from official papers but haven&apos;t been checked by an editor yet, so they aren&apos;t
            shown to students or counted as PYQs.
          </p>
        </section>
      )}
    </div>
  );
}
