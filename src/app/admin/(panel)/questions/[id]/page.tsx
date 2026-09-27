import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/admin/flash";
import { QuestionForm } from "@/components/admin/question-form";
import { SourceStamp, StatusStamp } from "@/components/provenance";
import { getQuestionForEdit } from "@/lib/data/admin";
import { getFormData } from "@/lib/data/admin-form";
import type { AnswerKey } from "@/lib/engine/grading";
import { DEMO_LABEL, PAPER_TYPE_LABELS, frequencyLine, isRealVerifiedPyq } from "@/lib/provenance";
import { safeJson } from "@/lib/text";
import { addSourceAction, deleteQuestionAction, removeSourceAction, setStatusAction } from "../../../actions";

export const metadata = { title: "Edit question" };

export default async function EditQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const qid = Number(id);
  if (!Number.isInteger(qid) || qid <= 0) notFound();
  const data = await getQuestionForEdit(qid);
  if (!data) notFound();
  const { q, sources, usedInPapers } = data;
  const { catalog, papers } = await getFormData();
  const key = safeJson<AnswerKey>(q.answerKey, null);
  const prov = { sourceType: q.sourceType, verificationStatus: q.verificationStatus, isDemo: q.isDemo, sources };
  const subjectPapers = papers.filter((p) => p.subjectId === q.subjectId && !sources.some((s) => s.paperId === p.id) && (q.isDemo || !p.isDemo));
  const freq = frequencyLine(prov);

  return (
    <div>
      <p className="text-sm">
        <Link href="/admin/questions" className="link">
          Questions
        </Link>
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[2rem]">Question {q.id}</h1>
        <SourceStamp q={prov} />
        <StatusStamp status={q.verificationStatus} />
        {!q.isPublished && <span className="stamp stamp-unverified">Unpublished</span>}
      </div>
      {q.externalKey && <p className="text-sm text-pencil">Key: {q.externalKey}</p>}
      <div className="mt-5">
        <Flash saved={sp.saved} error={sp.error} />
      </div>
      {q.isDemo && <p className="demo-banner mb-5 px-4 py-3 font-bold">{DEMO_LABEL}</p>}

      <div className="grid gap-8 xl:grid-cols-[1fr_24rem]">
        <QuestionForm
          key={q.updatedAt}
          catalog={catalog}
          papers={papers}
          isDemo={q.isDemo}
          hasSources={sources.length > 0}
          initial={{
            id: q.id,
            subjectId: q.subjectId,
            chapterId: q.chapterId,
            topicId: q.topicId,
            questionType: q.questionType,
            marks: q.marks,
            difficulty: q.difficulty,
            questionText: q.questionText,
            options: safeJson<string[]>(q.options, []),
            correctOption: key && "correctOption" in key ? key.correctOption : undefined,
            acceptedAnswers: key && "accepted" in key ? key.accepted.join("\n") : "",
            numericValue: key && "value" in key ? String(key.value) : "",
            numericTolerance: key && "value" in key ? String(key.tolerance ?? 0) : "",
            numericUnit: key && "value" in key ? (key.unit ?? "") : "",
            answerText: q.answerText,
            explanation: q.explanation,
            sourceType: q.sourceType,
            verificationStatus: q.verificationStatus,
            verificationNotes: q.verificationNotes,
            isPublished: q.isPublished,
          }}
        />

        <aside className="space-y-5">
          <section className="panel p-5" aria-labelledby="prov-title">
            <h2 id="prov-title" className="font-sans text-[1.05rem] font-bold">
              Provenance record
            </h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.93rem]">
              <dt className="text-pencil">Shown as real PYQ</dt>
              <dd className="font-bold">{isRealVerifiedPyq(prov) ? "Yes" : "No"}</dd>
              <dt className="text-pencil">Verified</dt>
              <dd>{q.verifiedAt ? `${new Date(q.verifiedAt).toLocaleDateString("en-IN")} by ${q.verifiedBy}` : "Not verified"}</dd>
              <dt className="text-pencil">Stored frequency</dt>
              <dd>{freq ?? `${q.frequencyCount} board paper${q.frequencyCount === 1 ? "" : "s"}`}</dd>
              <dt className="text-pencil">Used in papers</dt>
              <dd className="num">{usedInPapers}</dd>
              <dt className="text-pencil">Last updated</dt>
              <dd>{new Date(q.updatedAt).toLocaleString("en-IN")}</dd>
            </dl>
            <h3 className="mt-5 font-sans text-[0.95rem] font-bold">Linked source papers</h3>
            {sources.length === 0 ? (
              <p className="mt-1 text-[0.93rem] text-pencil">None. This question makes no past-paper claim.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {sources.map((s) => (
                  <li key={s.paperId} className="flex items-start justify-between gap-2 rounded-md border border-rule p-2.5 text-[0.93rem]">
                    <span>
                      <strong>{s.title}</strong>
                      <span className="block text-pencil">
                        {PAPER_TYPE_LABELS[s.paperType]}
                        {s.year ? `, ${s.year}` : ", no year"}
                        {s.questionNumber ? `, Q${s.questionNumber}` : ""}
                        {s.isDemo ? ", demo" : ""}
                      </span>
                    </span>
                    <form action={removeSourceAction}>
                      <input type="hidden" name="questionId" value={q.id} />
                      <input type="hidden" name="paperId" value={s.paperId} />
                      <button type="submit" className="btn btn-ghost btn-sm" aria-label={`Unlink ${s.title}`}>
                        Unlink
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={addSourceAction} className="mt-4 space-y-2 border-t border-rule pt-4">
              <input type="hidden" name="questionId" value={q.id} />
              <label htmlFor="add-paper" className="field-label">
                Add an appearance
              </label>
              <select id="add-paper" name="paperId" className="select" defaultValue="" required>
                <option value="">Choose a source paper</option>
                {subjectPapers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                    {p.year ? ` (${p.year})` : ""}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="questionNumber" className="input" placeholder="Question no." aria-label="Question number in that paper" />
                <input name="marksInPaper" type="number" min={1} max={20} className="input" placeholder="Marks" aria-label="Marks in that paper" />
              </div>
              <button type="submit" className="btn btn-secondary btn-sm w-full">
                Link source
              </button>
              <p className="field-hint">Each appearance in a board paper counts towards stored frequency.</p>
            </form>
          </section>

          <section className="panel space-y-3 p-5" aria-labelledby="danger-title">
            <h2 id="danger-title" className="font-sans text-[1.05rem] font-bold">
              Status and removal
            </h2>
            <div className="flex flex-wrap gap-2">
              {q.verificationStatus !== "UNVERIFIED" && (
                <form action={setStatusAction}>
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="status" value="UNVERIFIED" />
                  <input type="hidden" name="back" value={`/admin/questions/${q.id}`} />
                  <button type="submit" className="btn btn-secondary btn-sm">
                    Mark unverified
                  </button>
                </form>
              )}
              {q.verificationStatus !== "REJECTED" && (
                <form action={setStatusAction}>
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="status" value="REJECTED" />
                  <input type="hidden" name="back" value={`/admin/questions/${q.id}`} />
                  <button type="submit" className="btn btn-danger btn-sm">
                    Reject
                  </button>
                </form>
              )}
            </div>
            <form action={deleteQuestionAction} className="border-t border-rule pt-3">
              <input type="hidden" name="id" value={q.id} />
              <label className="flex items-start gap-2 text-[0.93rem]">
                <input type="checkbox" required className="mt-1 size-4 accent-[var(--color-margin)]" />
                <span>I want to delete this question permanently.{usedInPapers > 0 ? " It's used in papers, so it will be unpublished instead." : ""}</span>
              </label>
              <button type="submit" className="btn btn-danger btn-sm mt-2">
                Delete question
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
