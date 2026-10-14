import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnswerKeyText, TYPE_NAMES } from "@/components/question-block";
import { SourceStamp } from "@/components/provenance";
import { SelfReviewForm } from "@/components/self-review-form";
import type { SourceType } from "@/db/schema";
import { getAttemptResult } from "@/lib/data/attempts";
import { CountUp } from "@/components/motion/count-up";
import { DEMO_SOURCE_LABELS, SOURCE_LABELS } from "@/lib/provenance";
import { marksLabel } from "@/lib/engine/worksheet";
import { formatDuration, pct } from "@/lib/text";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Your results", robots: { index: false, follow: false } };

const LETTERS = ["a", "b", "c", "d", "e", "f"];

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const p = pct(value, max);
  const weak = max > 0 && p < 60;
  return (
    <div>
      <div className="flex justify-between gap-3 text-[0.95rem]">
        <span>{label}</span>
        <span className={`num whitespace-nowrap font-bold ${weak ? "text-margin" : ""}`}>
          {max > 0 ? `${value}/${max} (${p}%)` : "Not marked yet"}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-desk-deep" aria-hidden="true">
        <div className="h-full rounded-full" style={{ width: `${max ? (value / max) * 100 : 0}%`, background: weak ? "var(--color-margin)" : "var(--color-ink)" }} />
      </div>
    </div>
  );
}

function sourceLabel(key: string): string {
  if (key.startsWith("DEMO_")) return DEMO_SOURCE_LABELS[key.slice(5) as SourceType];
  return SOURCE_LABELS[key as SourceType].short;
}

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getAttemptResult(id);
  if (!r) notFound();
  const { summary: s, paper } = r;
  // Percentage of the marks already marked (the same rule everywhere: see summarise in engine/scoring.ts).
  const percent = s.percent ?? 0;
  const pyqMarks = paper.composition.VERIFIED_PYQ.marks;
  const pyqShare = pct(pyqMarks, paper.totalMarks);
  // Self-marked = not marked automatically when submitted (stored with the answer, not re-derived from today's key).
  const descriptive = r.items.filter((i) => !i.auto);
  const pendingDescriptive = descriptive.filter((i) => i.scored === null).length;

  let headline: string;
  if (s.evaluatedMax === 0) headline = "Mark your written answers to see your score.";
  else if (percent >= 85) headline = "A strong paper. Check the few marks you dropped below.";
  else if (percent >= 60) headline = "A solid attempt. The chapters below show where the rest of the marks are.";
  else if (percent >= 35) headline = "A useful attempt. Revising the chapters flagged below should lift your next score.";
  else headline = "This one was tough. Start with the first chapter in the revision list below.";

  return (
    <div className="container-page py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-pencil">
        <Link href="/my-practice" className="link">
          My practice
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Results</span>
      </nav>

      {paper.hasDemo && (
        <p className="ai-note mb-6 px-4 py-3">
          <strong>This paper included AI practice questions.</strong> They were written by AI and have never appeared in an exam.
        </p>
      )}

      {r.worksheet ? (
        <section className="sheet sheet-ruled py-7 pr-5 sm:py-10 sm:pr-10" aria-labelledby="score-title">
          <p className="text-sm font-bold text-pencil">
            {paper.board.name} {paper.cls.name} {paper.subject.name}
          </p>
          <h1 id="score-title" className="mt-1 text-[1.8rem] sm:text-[2.3rem]">
            Practice worksheet: {r.worksheet.checked === 0 ? "not graded" : r.worksheet.checked < r.worksheet.questions ? "partly checked" : "checked"}
          </h1>
          <p className="mt-2 max-w-2xl text-[1.05rem] text-pencil">
            A worksheet isn&apos;t a scored test, so there is no overall score or percentage. Questions with an answer key were checked automatically;
            the rest are shown below with their model answer where one is published.
          </p>
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-rule pt-6 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Time used", formatDuration(r.attempt.timeUsedSeconds)],
              ["Answered", `${r.worksheet.answered} of ${r.worksheet.questions}`],
              ["Checked automatically", String(r.worksheet.checked)],
              ["Correct", r.worksheet.checked ? `${r.worksheet.correct} of ${r.worksheet.checked}` : "–"],
              ["Not graded", String(r.worksheet.notGraded)],
              ["Unanswered", String(r.worksheet.unanswered)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm text-pencil">{k}</dt>
                <dd className="num mt-0.5 font-serif text-[1.35rem] font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          {r.worksheet.checkedMarks && (
            <p className="mt-4 text-[0.95rem]">
              On the {r.worksheet.checkedMarks.questions} checked question{r.worksheet.checkedMarks.questions === 1 ? "" : "s"} with printed marks:{" "}
              <strong className="num">
                {r.worksheet.checkedMarks.scored} of {r.worksheet.checkedMarks.max} marks
              </strong>
              . This covers only those questions, not the whole worksheet.
            </p>
          )}
        </section>
      ) : (
        <>
      {/* Score */}
      <section className="sheet sheet-ruled py-7 pr-5 sm:py-10 sm:pr-10" aria-labelledby="score-title">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
          <div className="relative grid size-36 shrink-0 place-items-center sm:size-44">
            <svg viewBox="0 0 100 100" className="absolute inset-0" aria-hidden="true">
              <path
                d="M50 6c26 0 44 17 44 43 0 27-20 45-45 45C23 94 6 76 6 51 6 26 25 8 52 7"
                fill="none"
                stroke="var(--color-margin)"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </svg>
            <p className="text-center font-serif font-semibold leading-none text-margin">
              <span className="num block text-[2.6rem] sm:text-[3.2rem]">
                <CountUp value={s.scored} />
              </span>
              <span className="num mt-1 block text-[1.1rem]">out of {s.evaluatedMax}</span>
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-pencil">
              {paper.board.name} {paper.cls.name} {paper.subject.name}
            </p>
            <h1 id="score-title" className="mt-1 text-[1.8rem] sm:text-[2.3rem]">
              {s.evaluatedMax > 0 ? `${percent}%` : "Waiting for your marking"}
            </h1>
            <p className="mt-2 max-w-xl text-[1.05rem] text-pencil">{headline}</p>
            {s.pendingReview > 0 && (
              <p className="mt-3 text-[0.95rem]">
                <strong>Provisional:</strong> this score covers {s.evaluatedMax} of {s.max} marks. {pendingDescriptive} written answer
                {pendingDescriptive === 1 ? " is" : "s are"} waiting for your marks.
              </p>
            )}
          </div>
        </div>
        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-rule pt-6 sm:grid-cols-4 lg:grid-cols-8">
          {[
            ["Time used", formatDuration(r.attempt.timeUsedSeconds)],
            ["Attempted", `${s.attempted} of ${r.items.length}`],
            ["Unanswered", String(s.unanswered)],
            ["Correct", String(s.correct)],
            ["Incorrect", String(s.incorrect)],
            ["Accuracy", s.accuracy === null ? "–" : `${s.accuracy}%`],
            ["Marked for review", String(s.markedForReview)],
            ["Self-marked", `${s.descriptiveReviewed} of ${s.descriptiveTotal}`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-sm text-pencil">{k}</dt>
              <dd className="num mt-0.5 font-serif text-[1.35rem] font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-pencil">
          Correct, incorrect and accuracy count only questions with an answer key (multiple choice, assertion–reason, fill in the blank, numerical). Questions
          without an official key are self-marked. There is no rank or percentile: only your own attempt is compared.
        </p>
      </section>

      <div className="mt-6">
        <SelfReviewForm attemptId={r.attempt.id} pending={pendingDescriptive} total={descriptive.filter((i) => i.answer?.response).length} />
      </div>

      {/* Analysis */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="sheet p-5 sm:p-6" aria-labelledby="chapters-title">
          <h2 id="chapters-title" className="font-sans text-[1.1rem] font-bold">
            By chapter
          </h2>
          <div className="mt-4 space-y-4">
            {r.chapters.map((c) => (
              <Bar key={c.key} label={c.label} value={c.scored} max={c.evaluatedMax} />
            ))}
          </div>
        </section>

        <section className="sheet p-5 sm:p-6" aria-labelledby="revise-title">
          <h2 id="revise-title" className="font-sans text-[1.1rem] font-bold">
            What to revise next
          </h2>
          {r.weak.length === 0 ? (
            <p className="mt-3 text-pencil">
              {s.attempted === 0
                ? "You didn't answer any questions, so there's nothing to judge yet."
                : s.evaluatedMax === 0
                  ? "Mark your written answers first, then this list will fill in."
                  : "No chapter is below 60% on the questions you answered. Try a harder or longer paper next."}
            </p>
          ) : (
            <ol className="mt-3 space-y-3">
              {r.weak.slice(0, 5).map((c) => (
                <li key={c.key} className="flex flex-col gap-2 border-b border-rule pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <strong>{c.label}</strong>
                    <span className="num block text-[0.9rem] text-pencil">
                      {c.answeredScored} of {c.answeredMax} mark{c.answeredMax === 1 ? "" : "s"} on answered questions ({pct(c.answeredScored, c.answeredMax)}%)
                    </span>
                  </span>
                  <Link href={`/practice?subject=${paper.subject.id}&chapter=${c.key}`} className="btn btn-secondary btn-sm">
                    Practise this chapter
                  </Link>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-4 border-t border-rule pt-3 text-sm text-pencil">
            {r.weak.length > 5 ? `The five weakest of ${r.weak.length} chapters under 60% are shown. See all of them in the chapter breakdown.` : "Chapters under 60% on the questions you answered are listed, weakest first. Skipped questions don't count against a chapter."}
          </p>
          {r.notReached.length > 0 && (
            <p className="mt-2 text-sm text-pencil">
              <strong className="text-graphite">Not attempted:</strong> {r.notReached.map((c) => c.label).join(", ")}.
            </p>
          )}
        </section>

        <section className="sheet p-5 sm:p-6" aria-labelledby="types-title">
          <h2 id="types-title" className="font-sans text-[1.1rem] font-bold">
            By question type
          </h2>
          <div className="mt-4 space-y-4">
            {r.types.map((t) => (
              <Bar key={t.key} label={t.label} value={t.scored} max={t.evaluatedMax} />
            ))}
          </div>
        </section>

        {r.sections.length > 1 && (
          <section className="sheet p-5 sm:p-6" aria-labelledby="sections-title">
            <h2 id="sections-title" className="font-sans text-[1.1rem] font-bold">
              By section
            </h2>
            <div className="mt-4 space-y-4">
              {r.sections.map((sec) => (
                <Bar key={sec.key} label={sec.label} value={sec.scored} max={sec.evaluatedMax} />
              ))}
            </div>
          </section>
        )}

        <section className="sheet p-5 sm:p-6" aria-labelledby="sources-title">
          <h2 id="sources-title" className="font-sans text-[1.1rem] font-bold">
            By question source
          </h2>
          <p className="mt-1 text-[0.95rem] text-pencil">
            Verified previous-year questions made up {pyqShare}% of this paper&apos;s marks.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2 text-[0.88rem]">
            {r.sources.map((src) => (
              <li key={src.key} className="rounded-full border border-rule bg-desk px-3 py-1">
                {sourceLabel(src.key)}: <strong className="num">{src.count}</strong>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-4">
            {r.sources.map((src) => (
              <Bar key={src.key} label={sourceLabel(src.key)} value={src.scored} max={src.evaluatedMax} />
            ))}
          </div>
        </section>
      </div>

        </>
      )}

      {/* Question review */}
      <section className="mt-10" aria-labelledby="review-title">
        <h2 id="review-title" className="text-[1.7rem]">
          Question by question
        </h2>
        <ol className="mt-5 space-y-4">
          {r.items.map((item, idx) => {
            const q = item.question;
            const auto = item.auto;
            const a = item.answer;
            const response = a?.response ?? null;
            const worksheet = Boolean(r.worksheet);
            const state = !response
              ? "unanswered"
              : auto
                ? a?.isCorrect
                  ? "correct"
                  : "incorrect"
                : worksheet
                  ? "not-graded"
                  : item.scored === null
                    ? "to-mark"
                    : "marked";
            const label = worksheet ? marksLabel({ marks: item.marks, marksStatus: item.marks > 0 ? "PRINTED" : q.marksStatus, marksNote: q.marksNote, practiceMarks: q.practiceMarks }) : null;
            const badge = {
              unanswered: ["Not answered", "text-pencil border-rule-strong"],
              correct: ["Correct", "text-verified border-verified bg-verified-soft"],
              incorrect: ["Incorrect", "text-margin border-margin bg-margin-soft"],
              "to-mark": ["Needs your marks", "text-ink border-ink bg-ink-soft"],
              marked: ["Self-marked", "text-ink border-ink-line"],
              "not-graded": ["Not graded", "text-pencil border-rule-strong"],
            }[state]!;
            // A choice answer is the option's index; anything else (older or unusual submissions) is shown as typed.
            const optionIdx = response !== null && /^\d+$/.test(response) ? Number(response) : -1;
            const shownResponse =
              (q.type === "MCQ" || q.type === "ASSERTION_REASON") && q.options?.[optionIdx] !== undefined ? `(${LETTERS[optionIdx]}) ${q.options[optionIdx]}` : response;
            return (
              <li key={item.position} className="sheet p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-serif text-[1.15rem]">
                    Question {idx + 1}
                    <span className="ml-2 font-sans text-[0.88rem] font-normal text-pencil">
                      {TYPE_NAMES[q.type]}, {q.chapter.name}
                    </span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`rounded border-[1.5px] px-2 py-0.5 text-[0.8rem] font-bold ${badge[1]}`}>{badge[0]}</span>
                    {label ? (
                      <span className="marks num" title={label.long}>
                        {auto && item.marks > 0 ? `${a?.isCorrect ? item.marks : 0}/${item.marks}` : label.short}
                      </span>
                    ) : (
                      <span className="marks num">
                        {item.scored ?? "–"}/{item.marks}
                      </span>
                    )}
                  </div>
                </div>
                <p className="paper-text mt-3">{q.text}</p>
                <div className="mt-2">
                  <SourceStamp q={q} compact />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-md border border-rule bg-desk/50 px-4 py-3">
                    <p className="text-sm font-bold text-pencil">Your answer</p>
                    <p className="paper-text mt-1 text-[1rem]">{shownResponse ?? <span className="font-sans italic text-pencil">No answer given</span>}</p>
                  </div>
                  <AnswerKeyText q={q} />
                </div>
                {!auto && response && !worksheet && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label htmlFor={`self-${q.id}`} className="font-bold">
                      Marks you award
                    </label>
                    <select
                      id={`self-${q.id}`}
                      name={`self-${q.id}`}
                      form="self-review"
                      className="select num w-auto min-w-[7rem]"
                      defaultValue={item.scored === null ? "" : String(item.scored)}
                    >
                      <option value="">Choose</option>
                      {Array.from({ length: item.marks * 2 + 1 }, (_, i) => i / 2).map((v) => (
                        <option key={v} value={v}>
                          {v} of {item.marks}
                        </option>
                      ))}
                    </select>
                    <button type="submit" form="self-review" className="btn btn-ghost btn-sm">
                      Save marks
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link href={`/practice?subject=${paper.subject.id}`} className="btn btn-primary">
          Build another {paper.subject.name} paper
        </Link>
        <Link href={`/test/${paper.id}`} className="btn btn-secondary">
          Retake this test
        </Link>
        <Link href={`/paper/${paper.id}`} className="btn btn-ghost">
          View the paper again
        </Link>
      </div>
    </div>
  );
}
