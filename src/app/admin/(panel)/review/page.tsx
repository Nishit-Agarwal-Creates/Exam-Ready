import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { SelectAll } from "@/components/admin/select-all";
import { AnswerKeyText, TYPE_NAMES } from "@/components/question-block";
import { listSourcesWithProgress } from "@/lib/data/admin";
import { searchQuestions } from "@/lib/data/questions";
import { AUTHORITY_LABELS, PAPER_TYPE_LABELS } from "@/lib/provenance";
import { reviewAction } from "../../actions";

export const metadata = { title: "Review queue" };

const LETTERS = "abcdef";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const sources = await listSourcesWithProgress();
  const paperId = Number(sp.paper);
  const current = sources.find((s) => s.paper.id === paperId);

  if (!current) {
    const pendingTotal = sources.reduce((t, s) => t + Number(s.pending), 0);
    return (
      <div>
        <Flash saved={sp.saved} error={sp.error} />
        <h1 className="text-[2rem]">Review queue</h1>
        <p className="prose-width mt-2 text-pencil">
          Extracted questions wait here until an editor compares them with the official document. Open a source, check each question against the PDF (page
          numbers are shown), then verify and publish. Extraction and AI suggestions never verify anything on their own.
        </p>
        <p className="mt-4 font-bold">
          <span className="num">{pendingTotal}</span> questions awaiting review across {sources.filter((s) => Number(s.pending) > 0).length} sources
        </p>
        <div className="panel mt-4 overflow-x-auto">
          <table className="table min-w-[52rem]">
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">
                  Extracted
                </th>
                <th scope="col" className="text-right">
                  Pending
                </th>
                <th scope="col" className="text-right">
                  Verified
                </th>
                <th scope="col" className="text-right">
                  Published
                </th>
                <th scope="col" className="text-right">
                  Flagged
                </th>
              </tr>
            </thead>
            <tbody>
              {sources.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-pencil">
                    No source documents yet. Add one under Sources, then import its questions.
                  </td>
                </tr>
              )}
              {sources.map((s) => (
                <tr key={s.paper.id}>
                  <td>
                    <Link href={`/admin/review?paper=${s.paper.id}`} className="font-bold text-ink hover:underline">
                      {s.paper.title}
                    </Link>
                    <span className="block text-sm text-pencil">
                      {s.board} {s.cls} {s.subject}
                    </span>
                  </td>
                  <td className="text-[0.9rem]">{s.paper.status.replace("_", " ").toLowerCase()}</td>
                  <td className="num text-right">{Number(s.extracted)}</td>
                  <td className="num text-right font-bold">{Number(s.pending)}</td>
                  <td className="num text-right">{Number(s.verified)}</td>
                  <td className="num text-right">{Number(s.published)}</td>
                  <td className="num text-right">{Number(s.flagged)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[0.95rem]">
          <Link href="/admin/questions?status=UNVERIFIED&demo=exclude" className="link font-bold">
            All unverified questions
          </Link>{" "}
          ·{" "}
          <Link href="/admin/questions?issues=any&demo=exclude" className="link font-bold">
            Questions with extraction issues
          </Link>
        </p>
      </div>
    );
  }

  const p = current.paper;
  const pending = await searchQuestions({ paperId: p.id, status: "UNVERIFIED", pageSize: 100 }, true);
  const back = `/admin/review?paper=${p.id}`;

  return (
    <div>
      <p className="text-sm">
        <Link href="/admin/review" className="link">
          Review queue
        </Link>
      </p>
      <h1 className="mt-1 text-[1.8rem]">{p.title}</h1>
      <div className="mt-5">
        <Flash saved={sp.saved} error={sp.error} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div>
          {pending.items.length === 0 ? (
            <p className="panel rounded-2xl p-6 text-pencil">Nothing left to review for this source.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">
                  <span className="num">{pending.total}</span> awaiting review
                </p>
                <SelectAll form="review-form" />
              </div>
              <ol className="space-y-3">
                {pending.items.map((q) => {
                  const link = q.sources.find((s) => s.paperId === p.id);
                  return (
                    <li key={q.id} className={`panel rounded-2xl p-4 ${q.hasFigure || q.extractionConfidence === "LOW" ? "border-contrib/50" : ""}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          name="ids"
                          value={q.id}
                          form="review-form"
                          id={`r-${q.id}`}
                          className="mt-1.5 size-5 shrink-0 accent-[var(--color-verified)]"
                          aria-label={`Select question ${link?.questionNumber ?? q.id}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-[0.88rem]">
                            <label htmlFor={`r-${q.id}`} className="font-bold">
                              Q{link?.questionNumber}
                              {link?.part ?? ""}
                            </label>
                            {link?.pageNumber && <span className="rounded-full bg-desk px-2 py-0.5">page {link.pageNumber}</span>}
                            <span className="rounded-full bg-desk px-2 py-0.5">{q.marks} marks</span>
                            <span className="rounded-full bg-desk px-2 py-0.5">{TYPE_NAMES[q.type]}</span>
                            {q.extractionConfidence && (
                              <span
                                className={`rounded-full px-2 py-0.5 font-bold ${q.extractionConfidence === "HIGH" ? "bg-verified-soft text-verified" : q.extractionConfidence === "MEDIUM" ? "bg-contrib-soft text-contrib" : "bg-margin-soft text-margin"}`}
                              >
                                {q.extractionConfidence.toLowerCase()} confidence
                              </span>
                            )}
                            {q.hasFigure && <span className="rounded-full bg-contrib-soft px-2 py-0.5 font-bold text-contrib">needs figure</span>}
                            {q.canonicalId && (
                              <Link href={`/admin/questions/${q.canonicalId}`} className="rounded-full bg-ink-soft px-2 py-0.5 font-bold text-ink">
                                duplicate of #{q.canonicalId}
                              </Link>
                            )}
                            <Link href={`/admin/questions/${q.id}`} className="link ml-auto">
                              Edit
                            </Link>
                          </div>
                          <p className="paper-text mt-2">{q.text}</p>
                          {q.options && q.options.length > 0 && (
                            <ol className="mt-1 grid gap-0.5 font-serif sm:grid-cols-2">
                              {q.options.map((o, i) => (
                                <li key={i}>
                                  ({LETTERS[i]}) {o}
                                </li>
                              ))}
                            </ol>
                          )}
                          <p className="mt-2 text-[0.88rem] text-pencil">
                            Chapter: <strong className="text-graphite">{q.chapter.name}</strong> {q.mappingStatus === "SUGGESTED" ? "(suggested)" : "(confirmed)"}
                          </p>
                          {q.extractionIssues.length > 0 && (
                            <ul className="mt-2 list-disc rounded-lg bg-contrib-soft/60 py-2 pl-8 pr-3 text-[0.88rem] text-contrib">
                              {q.extractionIssues.map((i) => (
                                <li key={i}>{i}</li>
                              ))}
                            </ul>
                          )}
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[0.9rem] font-bold text-ink">Answer on record</summary>
                            <div className="mt-2">
                              <AnswerKeyText q={q} />
                            </div>
                          </details>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="panel rounded-2xl p-4 text-[0.93rem]">
            <h2 className="font-sans text-[1.02rem] font-bold">Evidence</h2>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-pencil">Authority</dt>
              <dd>{AUTHORITY_LABELS[p.authority]}</dd>
              <dt className="text-pencil">Type</dt>
              <dd>
                {PAPER_TYPE_LABELS[p.paperType]}
                {p.year ? `, ${p.year}` : ", no year"}
              </dd>
              {p.paperCode && (
                <>
                  <dt className="text-pencil">Q.P. code</dt>
                  <dd>{p.paperCode}</dd>
                </>
              )}
              {p.pageCount && (
                <>
                  <dt className="text-pencil">Pages</dt>
                  <dd>{p.pageCount}</dd>
                </>
              )}
            </dl>
            {p.sourceUrl && (
              <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm mt-3 w-full">
                Open the official document
              </a>
            )}
            {p.sourceFile && <p className="mt-2 text-[0.85rem] text-pencil">Inside the archive: {p.sourceFile}</p>}
            {p.answerSourceUrl && (
              <a href={p.answerSourceUrl} target="_blank" rel="noopener noreferrer" className="link mt-2 block text-[0.9rem]">
                Official marking scheme
              </a>
            )}
          </div>
          {pending.items.length > 0 && (
            <form id="review-form" action={reviewAction} className="panel space-y-3 rounded-2xl p-4">
              <input type="hidden" name="back" value={back} />
              <label className="flex items-start gap-2 text-[0.93rem]">
                <input type="checkbox" name="checked" className="mt-1 size-5 shrink-0 accent-[var(--color-verified)]" />
                <span>I compared the selected questions with the official document: text, question number, marks and page.</span>
              </label>
              <label className="flex items-start gap-2 text-[0.93rem]">
                <input type="checkbox" name="confirmMapping" defaultChecked className="mt-1 size-5 shrink-0 accent-[var(--color-ink)]" />
                <span>Also confirm their chapter mapping</span>
              </label>
              <button type="submit" name="intent" value="verify-publish" className="btn btn-primary w-full">
                Verify and publish selected
              </button>
              <button type="submit" name="intent" value="verify" className="btn btn-secondary w-full">
                Verify only (don&apos;t publish)
              </button>
              <div className="border-t border-rule pt-3">
                <label htmlFor="reason" className="field-label">
                  Rejection reason
                </label>
                <input id="reason" name="reason" className="input" placeholder="e.g. text garbled, figure missing…" />
                <button type="submit" name="intent" value="reject" className="btn btn-danger btn-sm mt-2 w-full">
                  Reject selected
                </button>
              </div>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
