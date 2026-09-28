import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { Pagination } from "@/components/pagination";
import { SourceStamp, StatusStamp } from "@/components/provenance";
import { TYPE_NAMES } from "@/components/question-block";
import { QUESTION_TYPES, REVIEW_STATES, SOURCE_TYPES, VERIFICATION_STATUSES } from "@/db/schema";
import { searchQuestions } from "@/lib/data/questions";
import { getCatalog } from "@/lib/data/taxonomy";
import { filtersToQuery, parseQuestionFilters, type SearchParams } from "@/lib/filters";
import { REVIEW_STATE_LABELS, SOURCE_LABELS, STATUS_LABELS } from "@/lib/provenance";

export const metadata = { title: "Questions" };

export default async function AdminQuestions({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const f = parseQuestionFilters(sp);
  const catalog = await getCatalog();
  const subjects = catalog.flatMap((b) => b.classes.flatMap((c) => c.subjects.map((s) => ({ ...s, label: `${c.name} ${s.name}` }))));
  const selected = subjects.find((s) => s.id === f.subjectId);
  if (f.chapterId && !selected?.chapters.some((c) => c.id === f.chapterId)) f.chapterId = undefined;
  const res = await searchQuestions({ ...f, pageSize: 25 }, false);
  const subjectName = new Map(subjects.map((s) => [s.id, s.label]));
  const chapterSubject = new Map(subjects.flatMap((s) => s.chapters.map((c) => [c.id, s.id] as const)));

  return (
    <div>
      <Flash saved={sp.saved as string} error={sp.error as string} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[2rem]">Questions</h1>
        <Link href="/admin/questions/new" className="btn btn-primary">
          Add question
        </Link>
      </div>

      <form method="get" className="panel mt-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filter questions">
        <div>
          <label htmlFor="a-subject" className="field-label">
            Subject
          </label>
          <select id="a-subject" name="subject" className="select" defaultValue={f.subjectId ?? ""}>
            <option value="">All</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="a-chapter" className="field-label">
            Chapter
          </label>
          <select id="a-chapter" name="chapter" className="select" defaultValue={f.chapterId ?? ""} disabled={!selected}>
            <option value="">{selected ? "All chapters" : "Choose a subject first"}</option>
            {selected?.chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="a-source" className="field-label">
            Source
          </label>
          <select id="a-source" name="source" className="select" defaultValue={f.sourceType ?? ""}>
            <option value="">All</option>
            {SOURCE_TYPES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s].short}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="a-status" className="field-label">
            Status
          </label>
          <select id="a-status" name="status" className="select" defaultValue={f.status ?? ""}>
            <option value="">All</option>
            {VERIFICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="a-type" className="field-label">
            Type
          </label>
          <select id="a-type" name="type" className="select" defaultValue={f.type ?? ""}>
            <option value="">All</option>
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_NAMES[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="a-demo" className="field-label">
            Demo data
          </label>
          <select id="a-demo" name="demo" className="select" defaultValue={f.demo ?? ""}>
            <option value="">Include</option>
            <option value="exclude">Exclude demo</option>
            <option value="only">Demo only</option>
          </select>
        </div>
        <div>
          <label htmlFor="a-issues" className="field-label">
            Extraction issues
          </label>
          <select id="a-issues" name="issues" className="select" defaultValue={f.issues ?? ""}>
            <option value="">Any</option>
            <option value="any">Figure or low/medium confidence</option>
            <option value="figure">Needs a figure</option>
            <option value="low">Low confidence</option>
          </select>
        </div>
        <div>
          <label htmlFor="a-review" className="field-label">
            Review result
          </label>
          <select id="a-review" name="review" className="select" defaultValue={f.reviewState ?? ""}>
            <option value="">Any</option>
            {REVIEW_STATES.map((r) => (
              <option key={r} value={r}>
                {REVIEW_STATE_LABELS[r]?.label ?? r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="a-q" className="field-label">
            Search
          </label>
          <input id="a-q" name="q" type="search" className="input" defaultValue={f.q ?? ""} placeholder="Text or key" />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="btn btn-primary flex-1">
            Filter
          </button>
          <Link href="/admin/questions" className="btn btn-ghost">
            Reset
          </Link>
        </div>
      </form>

      <p className="mt-4 text-pencil">
        <span className="num font-bold text-graphite">{res.total}</span> questions
      </p>
      <div className="panel mt-2 overflow-x-auto">
        <table className="table min-w-[56rem]">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Question</th>
              <th scope="col">Subject and chapter</th>
              <th scope="col" className="text-right">
                Marks
              </th>
              <th scope="col">Source</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {res.items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-pencil">
                  No questions match these filters.
                </td>
              </tr>
            )}
            {res.items.map((q) => (
              <tr key={q.id}>
                <td className="num">{q.id}</td>
                <td className="max-w-[28rem]">
                  <Link href={`/admin/questions/${q.id}`} className="line-clamp-2 font-bold text-ink hover:underline">
                    {q.text}
                  </Link>
                  <span className="text-sm text-pencil">
                    {TYPE_NAMES[q.type]}
                    {!q.isPublished && ", unpublished"}
                  </span>
                </td>
                <td className="text-[0.9rem]">
                  {subjectName.get(chapterSubject.get(q.chapter.id) ?? 0)}
                  <span className="block text-pencil">{q.chapter.name}</span>
                </td>
                <td className="num text-right">{q.marks}</td>
                <td>
                  <SourceStamp q={q} compact />
                </td>
                <td>
                  <StatusStamp status={q.verificationStatus} />
                  {q.reviewState && q.reviewState !== "EDITOR_VERIFIED" && (
                    <span className="mt-1 block text-[0.8rem] text-pencil" title={q.reviewReason || undefined}>
                      {REVIEW_STATE_LABELS[q.reviewState]?.label ?? q.reviewState}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={res.page} pages={res.pages} href={(p) => `/admin/questions${filtersToQuery(f, { page: p > 1 ? p : undefined })}`} />
    </div>
  );
}
