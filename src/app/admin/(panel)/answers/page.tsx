import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { Pagination } from "@/components/pagination";
import { TYPE_NAMES } from "@/components/question-block";
import { ANSWER_ISSUES, answerIssueCounts, answerQueue, type AnswerQueueFilters } from "@/lib/data/answers";
import { getCatalog } from "@/lib/data/taxonomy";
import { STATUS_LABELS, type AnswerIssue } from "@/lib/engine/answers";
import type { QuestionType } from "@/db/schema";

export const metadata = { title: "Answers and marks" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const int = (v: string) => (/^\d+$/.test(v) ? Number(v) : undefined);

export default async function AnswersQueuePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const issue = ANSWER_ISSUES.find((i) => i.key === one(sp.issue))?.key as AnswerIssue | undefined;
  const f: AnswerQueueFilters = { issue, subjectId: int(one(sp.subject)), classId: int(one(sp.class)), boardId: int(one(sp.board)), page: int(one(sp.page)) ?? 1 };
  const catalog = await getCatalog();
  const subjects = catalog.flatMap((b) => b.classes.flatMap((c) => c.subjects.map((s) => ({ id: s.id, label: `${b.name} ${c.name} ${s.name}` }))));
  const [counts, res] = await Promise.all([answerIssueCounts({ subjectId: f.subjectId }), answerQueue(f)]);
  const q = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const base = { issue: f.issue, subject: f.subjectId, ...over };
    for (const [k, v] of Object.entries(base)) if (v !== undefined) p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div>
      <Flash saved={sp.saved as string} error={sp.error as string} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[2rem]">Answers and marks</h1>
        <a href={`/admin/answers/export${q({})}`} className="btn btn-secondary">
          Export CSV
        </a>
      </div>
      <p className="mt-2 max-w-3xl text-pencil">
        Questions whose answer, marks or source information is incomplete, across the live bank ({counts.TOTAL} questions in this scope). Write or review an
        answer draft, then publish it. Drafts are never shown to students or used for marking; an answer is labelled official only when you name and check its
        source.
      </p>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Issues">
        {ANSWER_ISSUES.map((i) => (
          <li key={i.key}>
            <Link
              href={`/admin/answers${q({ issue: i.key, page: undefined })}`}
              className={`panel block p-3 hover:border-ink ${f.issue === i.key ? "border-ink ring-2 ring-ink/20" : ""}`}
              aria-current={f.issue === i.key ? "true" : undefined}
            >
              <span className="num block font-serif text-[1.5rem] font-semibold">{counts[i.key]}</span>
              <span className="block font-bold">{i.label}</span>
              <span className="block text-[0.85rem] text-pencil">{i.hint}</span>
            </Link>
          </li>
        ))}
      </ul>

      <form method="get" className="panel mt-5 flex flex-wrap items-end gap-3 p-4" aria-label="Filter">
        {f.issue && <input type="hidden" name="issue" value={f.issue} />}
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="ans-subject" className="field-label">
            Board, class and subject
          </label>
          <select id="ans-subject" name="subject" className="select" defaultValue={f.subjectId ?? ""}>
            <option value="">All</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          Filter
        </button>
        <Link href="/admin/answers" className="btn btn-ghost">
          Reset
        </Link>
      </form>

      <p className="mt-4 text-pencil">
        <span className="num font-bold text-graphite">{res.total}</span> questions{f.issue ? ` with “${ANSWER_ISSUES.find((i) => i.key === f.issue)?.label}”` : ""}
      </p>
      <div className="panel mt-2 overflow-x-auto">
        <table className="table min-w-[64rem]">
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Board, class, subject and chapter</th>
              <th scope="col">Source</th>
              <th scope="col" className="text-right">
                Marks
              </th>
              <th scope="col">Answer</th>
              <th scope="col">Not in scored tests because</th>
            </tr>
          </thead>
          <tbody>
            {res.items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-pencil">
                  Nothing to do here.
                </td>
              </tr>
            )}
            {res.items.map((r) => (
              <tr key={r.id}>
                <td className="max-w-[22rem]">
                  <Link href={`/admin/answers/${r.id}`} className="line-clamp-2 font-bold text-ink hover:underline">
                    {r.text}
                  </Link>
                  <span className="text-sm text-pencil">
                    #{r.id}, {TYPE_NAMES[r.type as QuestionType] ?? r.type}
                  </span>
                </td>
                <td className="text-[0.9rem]">
                  {r.board} {r.className} {r.subject}
                  <span className="block text-pencil">{r.chapter}</span>
                </td>
                <td className="max-w-[14rem] text-[0.85rem]">{r.sourceRef}</td>
                <td className="num text-right text-[0.9rem]">
                  {r.marksStatus === "PRINTED" ? r.marks : r.marksStatus === "GROUP_TOTAL" ? "group total" : r.marksStatus === "FRACTIONAL" ? r.marksNote : "not printed"}
                  {r.practiceMarks ? <span className="block text-pencil">practice: {r.practiceMarks}</span> : null}
                </td>
                <td className="text-[0.85rem]">
                  {STATUS_LABELS[r.status]}
                  {r.draftStatus && <span className="block font-bold text-pending">{STATUS_LABELS[r.draftStatus]}</span>}
                </td>
                <td className="max-w-[18rem] text-[0.85rem]">{r.testReady ? <span className="text-verified">Usable in scored tests</span> : r.testReasons.join(" ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={res.page} pages={res.pages} href={(p) => `/admin/answers${q({ page: p > 1 ? p : undefined })}`} />
    </div>
  );
}
