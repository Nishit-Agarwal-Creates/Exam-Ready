import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/admin/flash";
import { SOURCE_TYPES } from "@/db/schema";
import { getImportBatch } from "@/lib/data/admin";
import { getSubjectByIdForAdmin } from "@/lib/data/taxonomy";
import { PAPER_TYPE_LABELS, SOURCE_LABELS } from "@/lib/provenance";
import { approveImportItemAction, rejectImportItemAction } from "../../../actions";

export const metadata = { title: "Review import" };

export default async function ImportReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await getImportBatch(Number(id));
  if (!data) notFound();
  const { batch, items, paper, duplicates } = data;
  const subject = await getSubjectByIdForAdmin(batch.subjectId);
  const defaultSource =
    paper?.paperType === "BOARD_EXAM" ? "VERIFIED_PYQ" : paper && ["SPECIMEN", "SAMPLE", "QUESTION_BANK"].includes(paper.paperType) ? "OFFICIAL_SAMPLE" : "USER_CONTRIBUTED";
  const canVerify = Boolean(paper && !paper.isDemo && (paper.paperType !== "BOARD_EXAM" || paper.year));

  return (
    <div>
      <p className="text-sm">
        <Link href="/admin/import" className="link">
          Import
        </Link>
      </p>
      <h1 className="mt-1 text-[2rem]">{batch.title}</h1>
      <p className="mt-1 text-pencil">
        {subject?.label}.{" "}
        {paper
          ? `Source: ${paper.title} (${PAPER_TYPE_LABELS[paper.paperType]}${paper.year ? `, ${paper.year}` : ", no year"}).`
          : "No source paper, so items can only be published as contributed questions."}
      </p>
      {paper?.paperType === "BOARD_EXAM" && !paper.year && (
        <p className="mt-3 rounded-md border-2 border-margin/60 bg-margin-soft px-4 py-2.5 text-[0.95rem] font-bold">
          This board paper has no year, so its questions can&apos;t be verified as PYQs. Add the year on the Source papers page first.
        </p>
      )}
      <div className="mt-5">
        <Flash saved={sp.saved} error={sp.error} />
      </div>

      <ol className="space-y-4">
        {items.map((item) => {
          const done = item.status !== "PENDING";
          return (
            <li key={item.id} id={`item-${item.id}`} className={`panel p-4 sm:p-5 ${done ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-sans text-[1.05rem] font-bold">
                  Item {item.position}
                  {item.questionNumber && <span className="font-normal text-pencil">, question {item.questionNumber}</span>}
                  {item.section && <span className="font-normal text-pencil">, section {item.section}</span>}
                </h2>
                <span
                  className={`stamp ${item.status === "APPROVED" ? "stamp-verified" : item.status === "REJECTED" ? "stamp-rejected" : "stamp-unverified"}`}
                >
                  {item.status === "APPROVED" ? "Published" : item.status === "REJECTED" ? "Rejected" : "Needs review"}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap gap-2 text-[0.85rem] text-pencil">
                {item.pageNumber && <span className="rounded-full bg-desk px-2 py-0.5">Page {item.pageNumber}</span>}
                {item.confidence && (
                  <span className={`rounded-full px-2 py-0.5 font-bold ${item.confidence === "HIGH" ? "bg-verified-soft text-verified" : item.confidence === "MEDIUM" ? "bg-contrib-soft text-contrib" : "bg-margin-soft text-margin"}`}>
                    Extraction confidence: {item.confidence.toLowerCase()}
                  </span>
                )}
                {item.detectedType && <span className="rounded-full bg-desk px-2 py-0.5">Detected: {item.detectedType.replace("_", " ").toLowerCase()}</span>}
              </p>
              {(() => {
                const issues = JSON.parse(item.issues || "[]") as string[];
                return issues.length ? (
                  <ul className="mt-2 list-disc rounded-lg bg-contrib-soft/60 py-2 pl-8 pr-3 text-[0.9rem] text-contrib">
                    {issues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                ) : null;
              })()}
              {item.options && (
                <ol className="mt-2 grid gap-1 text-[0.93rem] sm:grid-cols-2">
                  {(JSON.parse(item.options) as string[]).map((o, i) => (
                    <li key={i}>
                      ({"abcd"[i]}) {o}
                    </li>
                  ))}
                </ol>
              )}
              {item.duplicateOfQuestionId && (
                <p className="mt-2 rounded-md border border-contrib/40 bg-contrib-soft px-3 py-2 text-[0.93rem]">
                  <strong>Possible duplicate</strong> of{" "}
                  <Link href={`/admin/questions/${item.duplicateOfQuestionId}`} className="link">
                    question {item.duplicateOfQuestionId}
                  </Link>
                  : “{(duplicates.get(item.duplicateOfQuestionId) ?? "").slice(0, 140)}”. If it&apos;s the same question, reject this item and link the paper to
                  the existing question instead, so its frequency is counted.
                </p>
              )}
              {done ? (
                <p className="paper-text mt-3">{item.text}</p>
              ) : (
                <form action={approveImportItemAction} className="mt-3 space-y-3">
                  <input type="hidden" name="batchId" value={batch.id} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <div>
                    <label htmlFor={`t-${item.id}`} className="field-label">
                      Question text
                    </label>
                    <textarea id={`t-${item.id}`} name="text" className="textarea font-serif" rows={4} defaultValue={item.text} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="lg:col-span-2">
                      <label htmlFor={`c-${item.id}`} className="field-label">
                        Chapter {item.suggestedChapterId && <span className="font-normal text-pencil">(suggested by keyword match)</span>}
                      </label>
                      <select id={`c-${item.id}`} name="chapterId" className="select" defaultValue={item.suggestedChapterId ?? ""} required>
                        <option value="">Choose</option>
                        {subject?.chapters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`m-${item.id}`} className="field-label">
                        Marks
                      </label>
                      <input id={`m-${item.id}`} name="marks" type="number" min={1} max={20} className="input num" defaultValue={item.marks ?? ""} required />
                    </div>
                    <div>
                      <label htmlFor={`ty-${item.id}`} className="field-label">
                        Type
                      </label>
                      <select id={`ty-${item.id}`} name="questionType" className="select" defaultValue={item.detectedType ?? ((item.marks ?? 2) >= 4 ? "LONG_ANSWER" : "SHORT_ANSWER")}>
                        <option value="MCQ" disabled={!item.options}>
                          Multiple choice
                        </option>
                        <option value="ASSERTION_REASON" disabled={!item.options}>
                          Assertion–reason
                        </option>
                        <option value="SHORT_ANSWER">Short answer</option>
                        <option value="LONG_ANSWER">Long answer</option>
                        <option value="CASE_BASED">Case-based</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`s-${item.id}`} className="field-label">
                        Category
                      </label>
                      <select id={`s-${item.id}`} name="sourceType" className="select" defaultValue={defaultSource}>
                        {SOURCE_TYPES.filter((s) => s !== "AI_SUPPLEMENTARY").map((s) => (
                          <option key={s} value={s}>
                            {SOURCE_LABELS[s].short}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label htmlFor={`a-${item.id}`} className="field-label">
                      Model answer (optional)
                    </label>
                    <textarea id={`a-${item.id}`} name="answerText" className="textarea" rows={2} />
                  </div>
                  <label className={`flex items-start gap-2 text-[0.95rem] ${canVerify ? "" : "text-pencil"}`}>
                    <input type="checkbox" name="checkedAgainstSource" disabled={!canVerify} className="mt-1 size-4 accent-[var(--color-verified)]" />
                    <span>
                      I checked this question, its number and its marks against the source paper.
                      {!canVerify && " (Needs a source paper with a year.)"}
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className="btn btn-primary btn-sm">
                      Publish question
                    </button>
                    <button type="submit" formAction={rejectImportItemAction} formNoValidate className="btn btn-danger btn-sm">
                      Reject item
                    </button>
                  </div>
                </form>
              )}
              {item.questionId && (
                <Link href={`/admin/questions/${item.questionId}`} className="link mt-2 inline-block text-[0.93rem]">
                  Open question {item.questionId}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
