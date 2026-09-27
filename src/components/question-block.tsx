import type { QuestionType } from "@/db/schema";
import type { QuestionView } from "@/lib/data/questions";
import { answerAddsInfo } from "@/lib/answer-text";
import { ProvenanceDetails, SourceStamp } from "./provenance";

export const TYPE_NAMES: Record<QuestionType, string> = {
  MCQ: "Multiple choice",
  FILL_BLANK: "Fill in the blank",
  NUMERICAL: "Numerical",
  SHORT_ANSWER: "Short answer",
  LONG_ANSWER: "Long answer",
};

const LETTERS = ["a", "b", "c", "d", "e", "f"];

export function AnswerKeyText({ q }: { q: QuestionView }) {
  if (!q.answer) return null;
  const key = q.answer.key;
  let keyLine: string | null = null;
  if (key && "correctOption" in key && q.options) keyLine = `(${LETTERS[key.correctOption]}) ${q.options[key.correctOption]}`;
  else if (key && "accepted" in key) keyLine = key.accepted.join(" / ");
  else if (key && "value" in key) keyLine = `${key.value}${key.unit ? ` ${key.unit}` : ""}`;
  return (
    <div className="rounded-md border-l-4 border-verified bg-verified-soft/60 px-4 py-3">
      <p className="text-sm font-bold text-verified">Model answer</p>
      {keyLine && <p className="mt-1 font-bold">{keyLine}</p>}
      {answerAddsInfo(keyLine ?? "", q.answer.text) && <p className="paper-text mt-1 text-[1rem]">{q.answer.text}</p>}
      {q.answer.explanation && <p className="mt-2 text-[0.95rem] text-pencil">{q.answer.explanation}</p>}
    </div>
  );
}

/**
 * A question as printed on the paper: number, text, options and marks in the right margin,
 * with a quiet metadata line and expandable source details.
 */
export function QuestionBlock({
  number,
  q,
  marks,
  showAnswer = false,
  showMeta = true,
  headingLevel = 3,
}: {
  number: number | string;
  q: QuestionView;
  marks?: number;
  showAnswer?: boolean;
  showMeta?: boolean;
  headingLevel?: 2 | 3 | 4;
}) {
  const H = `h${headingLevel}` as "h2" | "h3" | "h4";
  return (
    <article className="grid grid-cols-[2rem_1fr_auto] gap-x-2 sm:grid-cols-[2.5rem_1fr_auto] sm:gap-x-3" aria-labelledby={`q-${q.id}-label`}>
      <H id={`q-${q.id}-label`} className="font-serif text-[1.08rem] font-semibold leading-[1.65]">
        <span className="sr-only">Question </span>
        {number}.
      </H>
      <div className="min-w-0">
        <p className="paper-text">{q.text}</p>
        {q.options && (
          <ol className="mt-2 grid gap-1 font-serif text-[1.03rem] sm:grid-cols-2 sm:gap-x-6">
            {q.options.map((o, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-semibold">({LETTERS[i]})</span>
                <span>{o}</span>
              </li>
            ))}
          </ol>
        )}
        {showMeta && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.88rem] text-pencil">
            <SourceStamp q={q} compact />
            <span>{q.chapter.name}</span>
            <span aria-hidden="true" className="text-rule-strong">
              |
            </span>
            <span>{TYPE_NAMES[q.type]}</span>
          </div>
        )}
        {showMeta && <ProvenanceDetails q={q} />}
        {showAnswer && q.answer && (
          <div className="mt-3">
            <AnswerKeyText q={q} />
          </div>
        )}
      </div>
      <p className="marks text-[1.05rem] leading-[1.65]" aria-label={`${marks ?? q.marks} marks`}>
        [{marks ?? q.marks}]
      </p>
    </article>
  );
}
