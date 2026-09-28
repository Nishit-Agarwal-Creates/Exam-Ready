import Link from "next/link";
import type { SubjectTrends } from "@/lib/data/trends";
import type { YearCoverage } from "@/lib/engine/coverage";
import { TYPE_NAMES } from "./question-block";
import type { QuestionType } from "@/db/schema";

const YEARS = [2026, 2025, 2024, 2023, 2022];

/** Year-by-year availability of verified PYQs. Years without data are shown as missing, never estimated. */
export function CoveragePanel({ byYear, verified, pending, pyqHref }: { byYear: YearCoverage[]; verified: number; pending: number; pyqHref: string }) {
  const map = new Map(byYear.map((y) => [y.year, y]));
  const years = [...new Set([...YEARS, ...byYear.map((y) => y.year)])].sort((a, b) => b - a);
  return (
    <section className="sheet p-5 sm:p-6" aria-labelledby="coverage-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="coverage-title" className="text-[1.4rem]">
          Previous-year question coverage
        </h2>
        <Link href={pyqHref} className="link text-[0.95rem] font-bold">
          Explore these PYQs
        </Link>
      </div>
      <p className="mt-1 text-[0.95rem] text-pencil">
        {verified > 0 ? `${verified} verified questions.` : "No verified previous-year questions yet."}
        {pending > 0 ? ` ${pending} extracted from official papers, awaiting review.` : ""}
      </p>
      <ul className="mt-4 grid grid-cols-5 gap-2">
        {years.slice(0, 5).map((y) => {
          const c = map.get(y);
          const state = c?.verified ? "verified" : c?.pending ? "pending" : "none";
          return (
            <li
              key={y}
              className={`rounded-xl border p-2 text-center ${state === "verified" ? "border-verified/40 bg-verified-soft" : state === "pending" ? "border-dashed border-pending/40 bg-pending-soft" : "border-rule"}`}
            >
              <span className="block font-bold num">{y}</span>
              <span className={`text-[0.78rem] ${state === "verified" ? "font-bold text-verified" : "text-pencil"}`}>
                {state === "verified" ? `✓ ${c!.verified}` : state === "pending" ? "in review" : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Evidence-based trends. Renders an honest empty state when there isn't verified data. */
export function TrendsPanel({ trends }: { trends: SubjectTrends }) {
  if (trends.verifiedQuestions === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-rule-strong p-5" aria-labelledby="trends-title">
        <h2 id="trends-title" className="text-[1.4rem]">
          Trends
        </h2>
        <p className="mt-2 text-pencil">
          Chapter frequency and repeated-question analysis appear here once verified previous-year questions are published for this subject. Nothing is
          estimated in the meantime.
        </p>
      </section>
    );
  }
  const maxPapers = Math.max(...trends.chapters.map((c) => c.papers), 1);
  return (
    <section className="sheet p-5 sm:p-6" aria-labelledby="trends-title">
      <h2 id="trends-title" className="text-[1.4rem]">
        Trends from verified papers
      </h2>
      <p className="mt-1 text-[0.95rem] text-pencil">
        Based on {trends.verifiedQuestions} verified questions from {trends.papers} paper{trends.papers === 1 ? "" : "s"} ({trends.years.join(", ")}). Duplicates
        across sets count once.
      </p>
      <h3 className="mt-5 font-sans text-[1rem] font-bold">Chapters by number of papers they appeared in</h3>
      <ul className="mt-2 space-y-2.5">
        {trends.chapters.slice(0, 10).map((c) => (
          <li key={c.chapterId}>
            <div className="flex justify-between gap-3 text-[0.93rem]">
              <span>{c.name}</span>
              <span className="num whitespace-nowrap text-pencil">
                {c.papers} paper{c.papers === 1 ? "" : "s"}, {c.marks} marks
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-desk-deep" aria-hidden="true">
              <div className="h-full rounded-full bg-ink" style={{ width: `${(c.papers / maxPapers) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <h3 className="font-sans text-[1rem] font-bold">Question types</h3>
          <ul className="mt-2 space-y-1 text-[0.93rem]">
            {trends.types.map((t) => (
              <li key={t.type} className="flex justify-between gap-3">
                <span>{TYPE_NAMES[t.type as QuestionType] ?? t.type}</span>
                <span className="num text-pencil">
                  {t.questions} Q, {t.marks} marks
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-sans text-[1rem] font-bold">Marks per question</h3>
          <ul className="mt-2 space-y-1 text-[0.93rem]">
            {trends.marksDistribution.map((m) => (
              <li key={m.marks} className="flex justify-between gap-3">
                <span>
                  {m.marks} mark{m.marks === 1 ? "" : "s"}
                </span>
                <span className="num text-pencil">{m.questions} questions</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <h3 className="mt-5 font-sans text-[1rem] font-bold">Repeated across exam years</h3>
      {trends.repeated.length === 0 ? (
        <p className="mt-1 text-[0.93rem] text-pencil">
          {trends.years.length < 2
            ? "Only one exam year is verified so far, so repeats across years can't be measured yet."
            : "No verified question has appeared in more than one exam year."}
        </p>
      ) : (
        <ul className="mt-2 space-y-2 text-[0.93rem]">
          {trends.repeated.slice(0, 5).map((r) => (
            <li key={r.groupId} className="rounded-lg bg-desk/70 px-3 py-2">
              <span className="line-clamp-2">{r.text}</span>
              <span className="text-pencil">Asked in {r.years.join(", ")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
