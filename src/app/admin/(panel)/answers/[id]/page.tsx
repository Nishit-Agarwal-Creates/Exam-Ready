import Link from "next/link";
import { notFound } from "next/navigation";
import { AnswerForm } from "@/components/admin/answer-form";
import { Flash } from "@/components/admin/flash";
import { TYPE_NAMES } from "@/components/question-block";
import type { AnswerDraft, QuestionType } from "@/db/schema";
import { ANSWER_ISSUES, getAnswerWork } from "@/lib/data/answers";
import { STATUS_LABELS } from "@/lib/engine/answers";
import { marksLabel } from "@/lib/engine/worksheet";

export const metadata = { title: "Answer and marks" };

export default async function AnswerWorkPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const qid = Number(id);
  if (!Number.isInteger(qid) || qid <= 0) notFound();
  const w = await getAnswerWork(qid);
  if (!w) notFound();
  // Prefill from the draft when there is one, otherwise from the published answer (revising it never touches other data).
  const initial: AnswerDraft = w.draft ?? {
    origin: "EDITOR",
    text: w.answerText,
    key: w.key,
    rubric: w.answerRubric,
    practiceMarks: w.practiceMarks,
    source: w.meta?.source,
  };
  const marks = marksLabel({ marks: w.marks, marksStatus: w.marksStatus, marksNote: w.marksNote, practiceMarks: w.practiceMarks });
  const issueLabels = new Map(ANSWER_ISSUES.map((i) => [i.key, i.label]));

  return (
    <div>
      <p className="text-sm">
        <Link href="/admin/answers" className="link">
          Answers and marks
        </Link>
      </p>
      <h1 className="mt-1 text-[2rem]">Question {w.id}</h1>
      {w.externalKey && <p className="text-sm text-pencil">Key: {w.externalKey}</p>}
      <div className="mt-5">
        <Flash saved={sp.saved} error={sp.error} />
      </div>
      <div className="grid gap-8 xl:grid-cols-[1fr_26rem]">
        <section aria-labelledby="ans-form-title" className="panel p-5">
          <h2 id="ans-form-title" className="text-[1.3rem]">
            Answer
          </h2>
          <div className="mt-4">
            <AnswerForm id={w.id} type={w.type} options={w.options} initial={initial} hasDraft={Boolean(w.draft)} draftOrigin={w.draft?.origin ?? null} />
          </div>
        </section>
        <aside className="space-y-5">
          <section className="panel p-5" aria-labelledby="q-title">
            <h2 id="q-title" className="text-[1.1rem]">
              The question
            </h2>
            <p className="paper-text mt-2 whitespace-pre-line">{w.text}</p>
            {w.options && (
              <ol className="mt-2 list-[lower-alpha] pl-6">
                {w.options.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ol>
            )}
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.92rem]">
              <dt className="text-pencil">Board and class</dt>
              <dd>
                {w.board} {w.className}
              </dd>
              <dt className="text-pencil">Subject</dt>
              <dd>{w.subject}</dd>
              <dt className="text-pencil">Chapter</dt>
              <dd>{w.chapter}</dd>
              <dt className="text-pencil">Type</dt>
              <dd>{TYPE_NAMES[w.type as QuestionType] ?? w.type}</dd>
              <dt className="text-pencil">Marks</dt>
              <dd>{marks.long}</dd>
              <dt className="text-pencil">Source</dt>
              <dd>
                {w.sources.length
                  ? w.sources.map((s) => (
                      <span key={s.paperId} className="block">
                        <Link href={`/sources/${s.paperId}`} className="link">
                          {s.title}
                        </Link>
                        {s.year ? ` (${s.year})` : ""}
                        {s.questionNumber ? `, Q${s.questionNumber}` : ""}
                        {s.pageNumber ? `, p. ${s.pageNumber}` : ""}
                      </span>
                    ))
                  : "No linked source"}
              </dd>
              <dt className="text-pencil">Published answer</dt>
              <dd>{STATUS_LABELS[w.status]}</dd>
              {w.draftStatus && (
                <>
                  <dt className="text-pencil">Draft</dt>
                  <dd className="font-bold text-pending">{STATUS_LABELS[w.draftStatus]}</dd>
                </>
              )}
            </dl>
            {w.hasFigure && (
              <p className="mt-3 text-[0.9rem]">
                This question uses a figure.{" "}
                <Link href={`/questions/${w.id}`} className="link">
                  See it with its figure
                </Link>{" "}
                before writing an answer.
              </p>
            )}
            <p className="mt-3 text-[0.9rem]">
              <Link href={`/admin/questions/${w.id}`} className="link">
                Edit the question itself
              </Link>{" "}
              (text, printed marks, chapter, sources).
            </p>
          </section>
          <section className="panel p-5" aria-labelledby="iss-title">
            <h2 id="iss-title" className="text-[1.1rem]">
              {w.testReady ? "Usable in scored tests" : "Not used in scored tests"}
            </h2>
            {!w.testReady && (
              <ul className="mt-1 list-disc pl-5 text-[0.92rem]">
                {w.testReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            {w.issues.length > 0 && (
              <p className="mt-3 text-[0.9rem] text-pencil">In the review queue for: {w.issues.map((i) => issueLabels.get(i) ?? i).join(", ")}.</p>
            )}
            {w.draft?.flags?.length ? (
              <div className="mt-3">
                <p className="text-sm font-bold">Flags from the draft</p>
                <ul className="list-disc pl-5 text-[0.9rem]">
                  {w.draft.flags.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
