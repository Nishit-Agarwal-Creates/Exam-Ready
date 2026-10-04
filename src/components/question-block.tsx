import Link from "next/link";
import type { QuestionType } from "@/db/schema";
import type { QuestionView } from "@/lib/data/questions";
import { answerAddsInfo } from "@/lib/answer-text";
import { citation } from "@/lib/provenance";
import { MathText } from "./math-text";
import { isIndented } from "@/lib/math-markup";
import { ProvenanceDetails, SourceStamp } from "./provenance";

export const TYPE_NAMES: Record<QuestionType, string> = {
  MCQ: "Multiple choice",
  ASSERTION_REASON: "Assertion–reason",
  FILL_BLANK: "Fill in the blank",
  NUMERICAL: "Numerical",
  SHORT_ANSWER: "Short answer",
  LONG_ANSWER: "Long answer",
  CASE_BASED: "Case-based",
};

const LETTERS = ["a", "b", "c", "d", "e", "f"];

/** Whether a question has anything to reveal: an answer key or answer text. */
export function hasAnswerContent(q: QuestionView) {
  return Boolean(q.answer && (q.answer.key || q.answer.text?.trim()));
}

/** In lists: a "Show answer" toggle when there is an answer, otherwise a quiet note instead of an empty toggle. */
export function ListAnswer({ q }: { q: QuestionView }) {
  if (!hasAnswerContent(q)) return <p className="mt-3 text-[0.88rem] text-pencil sm:ml-[3.25rem]">No official answer published for this question.</p>;
  return (
    <details className="mt-3 sm:ml-[3.25rem]">
      <summary className="inline-flex min-h-9 cursor-pointer items-center font-bold text-ink hover:underline">Show answer</summary>
      <div className="expand-in mt-2">
        <AnswerKeyText q={q} />
      </div>
    </details>
  );
}

export function AnswerKeyText({ q }: { q: QuestionView }) {
  if (!q.answer) return null;
  const key = q.answer.key;
  let keyLine: string | null = null;
  if (key && "correctOption" in key && q.options) keyLine = `(${LETTERS[key.correctOption]}) ${q.options[key.correctOption]}`;
  else if (key && "accepted" in key) keyLine = key.accepted.join(" / ");
  else if (key && "value" in key) keyLine = `${key.value}${key.unit ? ` ${key.unit}` : ""}`;
  const hasText = answerAddsInfo(keyLine ?? "", q.answer.text);
  if (!keyLine && !hasText) {
    return (
      <div className="rounded-xl border border-dashed border-rule-strong px-4 py-3 text-[0.95rem] text-pencil">
        No official answer has been published for this question, so none is shown.
      </div>
    );
  }
  const official = q.answerSource === "OFFICIAL_SCHEME";
  return (
    <div className={`rounded-xl border-l-4 px-4 py-3 ${official ? "border-verified bg-verified-soft/60" : "border-ink-line bg-ink-soft/50"}`}>
      <p className={`text-sm font-bold ${official ? "text-verified" : "text-ink"}`}>
        {official ? "Official marking scheme" : q.answerSource === "AI" ? "Model answer (written by AI)" : "Model answer"}
      </p>
      {keyLine && (
        <p className="mt-1 font-bold">
          <MathText text={keyLine} />
        </p>
      )}
      {hasText && (
        <p className="paper-text mt-1 text-[1rem]" data-indented={isIndented(q.answer.text) || undefined}>
          <MathText text={q.answer.text} />
        </p>
      )}
      {q.answer.explanation && <p className="mt-2 text-[0.95rem] text-pencil">{q.answer.explanation}</p>}
      {official && hasText && /(…|\.\.\.)\s*$/.test(q.answer.text) && <ShortenedNote q={q} />}
    </div>
  );
}

/** Long official answers are stored shortened to their value points; say so and point to the full text. */
function ShortenedNote({ q }: { q: QuestionView }) {
  const src = q.sources.find((s) => !s.isDemo);
  return (
    <p className="mt-2 text-[0.88rem] text-pencil">
      Shortened here. The full official answer is in{" "}
      {src ? (
        <a href={`/sources/${src.paperId}`} className="link">
          the source document
        </a>
      ) : (
        "the source document"
      )}
      .
    </p>
  );
}

/** Figure / extraction notice shown with a question when the text can't stand on its own. */
export function FigureNotice({ q }: { q: QuestionView }) {
  if (!q.hasFigure) return null;
  const src = q.sources.find((s) => !s.isDemo);
  return (
    <p className="mt-2 flex items-start gap-2 rounded-lg bg-contrib-soft/70 px-3 py-2 text-[0.9rem] text-contrib">
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="m3 16 5-5 4 4 3-3 6 6" />
      </svg>
      <span>
        This question uses a figure or table that isn&apos;t reproduced here.
        {src ? (
          <>
            {" "}
            See {src.pageNumber ? `page ${src.pageNumber} of ` : ""}
            <Link href={`/sources/${src.paperId}`} className="link font-bold">
              the source paper
            </Link>
            .
          </>
        ) : null}
      </span>
    </p>
  );
}

/** One-line source citation for lists; the question's own page has the full source details. */
function CitationLine({ q }: { q: QuestionView }) {
  const src = q.sources.find((s) => !s.isDemo);
  if (!src) return null;
  return (
    <p className="mt-2 text-[0.85rem] text-pencil">
      Source:{" "}
      <Link href={`/sources/${src.paperId}`} className="link">
        {citation(src)}
      </Link>
      {src.pageNumber ? `, page ${src.pageNumber}` : ""}
      {q.extractionIssues.length > 0 && (
        <>
          {" "}
          <Link href={`/questions/${q.id}`} className="text-contrib underline underline-offset-2">
            extraction notes
          </Link>
        </>
      )}
    </p>
  );
}

/**
 * A question as printed on the paper: number, text, options and marks, with a quiet metadata
 * line (provenance stamp, chapter, type) and expandable source details.
 */
export function QuestionBlock({
  number,
  q,
  marks,
  showAnswer = false,
  showMeta = true,
  headingLevel = 3,
  provenance = "full",
}: {
  number: number | string;
  q: QuestionView;
  marks?: number;
  showAnswer?: boolean;
  showMeta?: boolean;
  headingLevel?: 2 | 3 | 4;
  /** "line" shows a one-line citation instead of the expandable source details (lighter, for long lists). */
  provenance?: "full" | "line";
}) {
  const H = `h${headingLevel}` as "h2" | "h3" | "h4";
  const m = marks ?? q.marks;
  return (
    <article className="grid grid-cols-[2rem_1fr_auto] gap-x-2 sm:grid-cols-[2.5rem_1fr_auto] sm:gap-x-3" aria-labelledby={`q-${q.id}-label`}>
      <H id={`q-${q.id}-label`} className="font-serif text-[1.08rem] font-semibold leading-[1.65]">
        <span className="sr-only">Question </span>
        {number}.
      </H>
      <div className="min-w-0">
        <p className="paper-text" data-indented={isIndented(q.text) || undefined}>
          <MathText text={q.text} />
        </p>
        {q.options && q.options.length > 0 && (
          <ol className="mt-2 grid gap-1 font-serif text-[1.03rem] sm:grid-cols-2 sm:gap-x-6">
            {q.options.map((o, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-semibold">({LETTERS[i]})</span>
                <span>
                  <MathText text={o} />
                </span>
              </li>
            ))}
          </ol>
        )}
        <FigureNotice q={q} />
        {showMeta && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.88rem] text-pencil">
            <SourceStamp q={q} compact />
            <span>
              {q.chapter.name}
              {q.mappingStatus === "SUGGESTED" && <span className="ml-1 text-[0.8rem] italic">(chapter suggested, not yet confirmed)</span>}
            </span>
            {/* A dot drawn before the type, kept with it so a wrap never leaves a stray separator at a line start. */}
            <span className="inline-flex items-center gap-2 before:size-1 before:rounded-full before:bg-rule-strong before:content-['']">{TYPE_NAMES[q.type]}</span>
          </div>
        )}
        {showMeta && provenance === "full" && (
          <ProvenanceDetails q={q} groupSources={q.groupSources} answerSource={q.answer ? q.answerSource : undefined} issues={q.extractionIssues} reviewState={q.reviewState} />
        )}
        {showMeta && provenance === "line" && <CitationLine q={q} />}
        {showAnswer && q.answer && (
          <div className="mt-3">
            <AnswerKeyText q={q} />
          </div>
        )}
      </div>
      <p className="marks self-start rounded-full bg-desk px-2.5 py-0.5 text-[0.98rem] leading-[1.65]" aria-label={`${m} ${m === 1 ? "mark" : "marks"}`}>
        [{m}]
      </p>
    </article>
  );
}
