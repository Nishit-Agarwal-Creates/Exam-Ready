import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SubjectGlyph } from "@/components/subject-glyph";
import { coverageStatus, getBankTotals, getChapterCoverage, getSubjectCoverage, type CoverageCounts, type SubjectCoverage } from "@/lib/data/coverage";
import { one, type SearchParams } from "@/lib/filters";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Question coverage by board, class, subject and chapter",
  description:
    "What ExamReady actually has, counted live from the database: verified previous-year questions, official sample and specimen questions, AI practice and source papers for every ICSE and CBSE class.",
  path: "/coverage",
});

const TONE: Record<string, string> = {
  strong: "border-verified/40 bg-verified-soft text-verified",
  growing: "border-official/40 bg-official-soft text-official",
  limited: "border-contrib/40 bg-contrib-soft text-contrib",
  none: "border-rule-strong bg-desk text-pencil",
};

function StatusChip({ c, scope }: { c: CoverageCounts; scope?: "subject" | "class" }) {
  const s = coverageStatus(c, scope);
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[0.8rem] font-bold ${TONE[s.tone]}`}>{s.label}</span>;
}

function Cell({ n, tone }: { n: number; tone: "verified" | "official" | "ai" | "pending" | "held" }) {
  if (!n) return <span className="text-pencil/60">0</span>;
  const cls = { verified: "text-verified", official: "text-official", ai: "text-ai", pending: "text-pending", held: "text-contrib" }[tone];
  return <span className={`num font-bold ${cls}`}>{n}</span>;
}

function yearsText(c: CoverageCounts) {
  if (c.years.length) return c.years.length > 3 ? `${c.years[c.years.length - 1]}–${c.years[0]} (${c.years.length} years)` : c.years.join(", ");
  if (c.pendingYears.length) return `${c.pendingYears.join(", ")} (awaiting review)`;
  return "—";
}

const sum = (rows: SubjectCoverage[]): CoverageCounts => ({
  verifiedPyq: rows.reduce((t, r) => t + r.verifiedPyq, 0),
  officialSample: rows.reduce((t, r) => t + r.officialSample, 0),
  community: rows.reduce((t, r) => t + r.community, 0),
  aiPractice: rows.reduce((t, r) => t + r.aiPractice, 0),
  awaitingReview: rows.reduce((t, r) => t + r.awaitingReview, 0),
  awaitingPyq: rows.reduce((t, r) => t + r.awaitingPyq, 0),
  held: rows.reduce((t, r) => t + r.held, 0),
  years: [...new Set(rows.flatMap((r) => r.years))].sort((a, b) => b - a),
  pendingYears: [],
});

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
  const boardName = boards.find(([b]) => b === boardSlug)?.[1] ?? "";

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
          Counted live from the database. Verified questions were checked against the official document; the same question in several sets counts once.
          AI practice is counted separately and never as a previous-year question. Where nothing is available yet, it says so.
        </p>
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Verified PYQs", totals.verifiedPyq, "text-verified"],
          ["Verified official samples & specimens", totals.officialSample, "text-official"],
          ["AI practice", totals.aiPractice, "text-ai"],
          ["Awaiting review", totals.awaitingReview, "text-pending"],
          ["Held back (figure, answer or check issue)", totals.held, "text-contrib"],
          ["Source documents", totals.sources, "text-ink"],
        ].map(([label, n, cls]) => (
          <div key={label as string} className="panel rounded-2xl p-4">
            <dt className="text-[0.85rem] leading-snug text-pencil">{label}</dt>
            <dd className={`num mt-1 font-serif text-[1.9rem] font-semibold ${cls}`}>{n as number}</dd>
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
      {boardSlug === "icse" && (
        <p className="prose-width mt-4 rounded-xl border border-rule bg-sheet px-4 py-3 text-[0.95rem] text-pencil">
          ICSE and ISC questions come from CISCE&apos;s own published papers (board examinations, specimens and item banks) and, for classes without
          board papers, from school examination papers (the school is usually not named). Each one is credited to its original document and links to where it was obtained; see{" "}
          <Link href="/sources" className="link">
            Sources
          </Link>
          .
        </p>
      )}

      <section aria-labelledby="overview-title" className="mt-6">
        <h2 id="overview-title" className="text-[1.5rem]">
          {boardName} by class
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {classes.map((c) => {
            const subs = boardRows.filter((r) => r.classId === c.classId);
            const t = sum(subs);
            const sourced = t.verifiedPyq + t.officialSample + t.community;
            return (
              <li key={c.classId}>
                <a href={`#class-${c.classId}`} className="tilt-card flex h-full flex-col rounded-2xl border border-rule bg-sheet p-4">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-serif text-[1.3rem] font-semibold">{c.className}</span>
                    <StatusChip c={t} scope="class" />
                  </span>
                  <span className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.88rem]">
                    <span className="text-pencil">Verified, source-backed</span>
                    <span className="num text-right font-bold text-verified">{sourced}</span>
                    <span className="text-pencil">AI practice</span>
                    <span className="num text-right font-bold text-ai">{t.aiPractice}</span>
                    <span className="text-pencil">Awaiting review</span>
                    <span className="num text-right text-pending">{t.awaitingReview}</span>
                    <span className="text-pencil">Held</span>
                    <span className="num text-right text-contrib">{t.held}</span>
                  </span>
                  <span className="mt-3 text-[0.82rem] text-pencil">{subs.map((s) => s.subjectName).join(", ")}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-10 space-y-8">
        {classes.map((c) => {
          const subs = boardRows.filter((r) => r.classId === c.classId);
          return (
            <section key={c.classId} id={`class-${c.classId}`} aria-labelledby={`cov-${c.classId}`} className="scroll-mt-24">
              <h2 id={`cov-${c.classId}`} className="text-[1.4rem]">
                {c.className}
              </h2>
              <div className="panel mt-3 rounded-2xl lg:overflow-x-auto">
                <table className="table table-stack table-stack-lg lg:min-w-[52rem]">
                  <thead>
                    <tr>
                      <th scope="col">Subject</th>
                      <th scope="col" className="text-right">
                        Verified PYQs
                      </th>
                      <th scope="col" className="text-right">
                        Official
                      </th>
                      <th scope="col" className="text-right">
                        AI practice
                      </th>
                      <th scope="col" className="text-right">
                        Awaiting
                      </th>
                      <th scope="col" className="text-right">
                        Held
                      </th>
                      <th scope="col">Exam years</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.map((r) => (
                      <tr key={r.subjectId} className={r.subjectId === subjectId ? "bg-ink-soft/50" : undefined}>
                        <th scope="row" className="!text-[0.95rem] !font-bold !text-graphite">
                          <Link href={`/coverage?board=${boardSlug}&subject=${r.subjectId}#chapters`} className="glyph-host inline-flex items-center gap-2 hover:underline">
                            <span className="text-ink">
                              <SubjectGlyph slug={r.subjectSlug} size={24} />
                            </span>
                            {r.subjectName}
                          </Link>
                          <span className="block text-[0.8rem] font-normal text-pencil">
                            {r.chapterCount ? `${r.chapterCount} chapters` : "Chapter list not added yet"}
                            {r.sourcePapers.boardExam + r.sourcePapers.sample + r.sourcePapers.other > 0
                              ? `, ${r.sourcePapers.boardExam} board paper${r.sourcePapers.boardExam === 1 ? "" : "s"}, ${r.sourcePapers.sample + r.sourcePapers.other} other official`
                              : ""}
                          </span>
                        </th>
                        <td className="text-right" data-label="Verified PYQs">
                          <Cell n={r.verifiedPyq} tone="verified" />
                        </td>
                        <td className="text-right" data-label="Official sample/specimen">
                          <Cell n={r.officialSample} tone="official" />
                        </td>
                        <td className="text-right" data-label="AI practice">
                          <Cell n={r.aiPractice} tone="ai" />
                        </td>
                        <td className="text-right" data-label="Awaiting review">
                          <Cell n={r.awaitingReview} tone="pending" />
                        </td>
                        <td className="text-right" data-label="Held back">
                          <Cell n={r.held} tone="held" />
                        </td>
                        <td className="text-[0.9rem]" data-label="Exam years">
                          {yearsText(r)}
                        </td>
                        <td data-label="Status">
                          <StatusChip c={r} />
                        </td>
                      </tr>
                    ))}
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
              <table className="table table-stack sm:min-w-[44rem]">
                <thead>
                  <tr>
                    <th scope="col">Chapter</th>
                    <th scope="col" className="text-right">
                      Verified PYQs
                    </th>
                    <th scope="col" className="text-right">
                      Official
                    </th>
                    <th scope="col" className="text-right">
                      AI practice
                    </th>
                    <th scope="col" className="text-right">
                      Awaiting
                    </th>
                    <th scope="col" className="text-right">
                      Held
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
                      <td className="text-right" data-label="Official sample/specimen">
                        <Cell n={ch.officialSample} tone="official" />
                      </td>
                      <td className="text-right" data-label="AI practice">
                        <Cell n={ch.aiPractice} tone="ai" />
                      </td>
                      <td className="text-right" data-label="Awaiting review">
                        <Cell n={ch.awaitingReview} tone="pending" />
                      </td>
                      <td className="text-right" data-label="Held back">
                        <Cell n={ch.held} tone="held" />
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
            &ldquo;Awaiting review&rdquo; questions were extracted from official papers but not yet checked. &ldquo;Held&rdquo; questions were checked and
            held back, for example because a figure they need isn&apos;t reproduced or notation was lost in extraction.
          </p>
        </section>
      )}
    </div>
  );
}
