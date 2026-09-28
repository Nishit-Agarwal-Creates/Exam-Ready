import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { PAPER_TYPES, SOURCE_AUTHORITIES, SOURCE_STATUSES } from "@/db/schema";
import { listPapers } from "@/lib/data/admin";
import { getCatalog } from "@/lib/data/taxonomy";
import { AUTHORITY_LABELS, PAPER_TYPE_LABELS } from "@/lib/provenance";
import { deletePaperAction, savePaperAction } from "../../actions";

export const metadata = { title: "Source papers" };

export default async function PapersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [rows, catalog] = await Promise.all([listPapers(), getCatalog()]);
  const subjects = catalog.flatMap((b) => b.classes.flatMap((c) => c.subjects.map((s) => ({ id: s.id, label: `${b.name} ${c.name} ${s.name}` }))));
  const editing = rows.find((r) => String(r.paper.id) === sp.edit && !r.paper.isDemo)?.paper;
  const real = rows.filter((r) => !r.paper.isDemo);
  const demo = rows.filter((r) => r.paper.isDemo);

  return (
    <div>
      <Flash saved={sp.saved} error={sp.error} />
      <h1 className="text-[2rem]">Sources</h1>
      <p className="prose-width mt-2 text-pencil">
        Board exam papers, specimen papers and sample papers that questions are checked against. A question can only be a Verified PYQ when it links to a
        board exam paper with a year.
      </p>

      <div className="mt-6 grid gap-8 xl:grid-cols-[1fr_24rem]">
        <section aria-labelledby="list-title">
          <h2 id="list-title" className="font-sans text-[1.1rem] font-bold">
            Papers ({real.length})
          </h2>
          <div className="panel mt-2 overflow-x-auto">
            <table className="table min-w-[40rem]">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Subject</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="text-right">
                    Year
                  </th>
                  <th scope="col" className="text-right">
                    Linked Q
                  </th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {real.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-pencil">
                      No real source papers yet. Add the first one with the form.
                    </td>
                  </tr>
                )}
                {real.map(({ paper: p, subject, cls, links }) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.title}</strong>
                      {p.sourceUrl && (
                        <a href={p.sourceUrl} className="link block text-sm" target="_blank" rel="noopener noreferrer">
                          Source link
                        </a>
                      )}
                    </td>
                    <td>
                      {cls} {subject}
                    </td>
                    <td>{PAPER_TYPE_LABELS[p.paperType]}</td>
                    <td className="num text-right">{p.year ?? <span className="text-margin">Missing</span>}</td>
                    <td className="num text-right">{links}</td>
                    <td className="whitespace-nowrap text-right">
                      <Link href={`/admin/papers?edit=${p.id}`} className="btn btn-ghost btn-sm">
                        Edit
                      </Link>
                      <Link href={`/admin/questions?q=&subject=${p.subjectId}`} className="btn btn-ghost btn-sm">
                        Questions
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {demo.length > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer font-bold text-demo">Fictional demo papers ({demo.length})</summary>
              <p className="mt-2 text-[0.93rem] text-pencil">
                These exist only to demonstrate provenance and frequency. They have no year and can&apos;t make a question a real PYQ.
              </p>
              <ul className="mt-2 columns-1 text-[0.93rem] sm:columns-2">
                {demo.map(({ paper: p, subject, cls, links }) => (
                  <li key={p.id}>
                    {cls} {subject}: {p.title} ({links} links)
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section className="panel h-fit p-5" aria-labelledby="form-title">
          <h2 id="form-title" className="font-sans text-[1.1rem] font-bold">
            {editing ? `Edit “${editing.title}”` : "Add a source paper"}
          </h2>
          <form action={savePaperAction} className="mt-4 space-y-4" key={editing?.id ?? "new"}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div>
              <label htmlFor="p-subject" className="field-label">
                Subject
              </label>
              <select id="p-subject" name="subjectId" className="select" defaultValue={editing?.subjectId ?? ""} required>
                <option value="">Choose</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="p-title" className="field-label">
                Title
              </label>
              <input id="p-title" name="title" className="input" defaultValue={editing?.title} placeholder="ICSE 2024 Chemistry (Science Paper 2)" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="p-type" className="field-label">
                  Type
                </label>
                <select id="p-type" name="paperType" className="select" defaultValue={editing?.paperType ?? "BOARD_EXAM"}>
                  {PAPER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {PAPER_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="p-year" className="field-label">
                  Year
                </label>
                <input id="p-year" name="year" inputMode="numeric" className="input num" defaultValue={editing?.year ?? ""} placeholder="2024" />
              </div>
            </div>
            <div>
              <label htmlFor="p-url" className="field-label">
                Link to the original (optional)
              </label>
              <input id="p-url" name="sourceUrl" type="url" className="input" defaultValue={editing?.sourceUrl ?? ""} placeholder="https://" />
            </div>
            <div>
              <label htmlFor="p-authority" className="field-label">
                Source authority
              </label>
              <select id="p-authority" name="authority" className="select" defaultValue={editing?.authority ?? "OFFICIAL_BOARD"}>
                {SOURCE_AUTHORITIES.map((a) => (
                  <option key={a} value={a}>
                    {AUTHORITY_LABELS[a]}
                  </option>
                ))}
              </select>
              <p className="field-hint mt-1">Only choose an official authority when the document comes from that authority.</p>
            </div>
            <details className="rounded-xl border border-rule p-3">
              <summary className="cursor-pointer font-bold">More metadata (fill in only what the document shows)</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="p-authorityName" className="field-label">
                  Authority name
                </label>
                <input id="p-authorityName" name="authorityName" className="input" defaultValue={editing?.authorityName ?? ""} placeholder="Central Board of Secondary Education" />
              </div>
              <div>
                <label htmlFor="p-examSession" className="field-label">
                  Session
                </label>
                <input id="p-examSession" name="examSession" className="input" defaultValue={editing?.examSession ?? ""} placeholder="Main examination" />
              </div>
              <div>
                <label htmlFor="p-paperName" className="field-label">
                  Paper name
                </label>
                <input id="p-paperName" name="paperName" className="input" defaultValue={editing?.paperName ?? ""} placeholder="Science (086)" />
              </div>
              <div>
                <label htmlFor="p-paperCode" className="field-label">
                  Q.P. / paper code
                </label>
                <input id="p-paperCode" name="paperCode" className="input" defaultValue={editing?.paperCode ?? ""} placeholder="31/2/1" />
              </div>
              <div>
                <label htmlFor="p-setCode" className="field-label">
                  Set
                </label>
                <input id="p-setCode" name="setCode" className="input" defaultValue={editing?.setCode ?? ""} placeholder="SET-1" />
              </div>
              <div>
                <label htmlFor="p-seriesCode" className="field-label">
                  Series
                </label>
                <input id="p-seriesCode" name="seriesCode" className="input" defaultValue={editing?.seriesCode ?? ""} placeholder="" />
              </div>
              <div>
                <label htmlFor="p-region" className="field-label">
                  Region
                </label>
                <input id="p-region" name="region" className="input" defaultValue={editing?.region ?? ""} placeholder="" />
              </div>
              <div>
                <label htmlFor="p-language" className="field-label">
                  Language
                </label>
                <input id="p-language" name="language" className="input" defaultValue={editing?.language ?? ""} placeholder="English" />
              </div>
              <div>
                <label htmlFor="p-sourceFile" className="field-label">
                  File inside archive
                </label>
                <input id="p-sourceFile" name="sourceFile" className="input" defaultValue={editing?.sourceFile ?? ""} placeholder="Science/31-2-1.pdf" />
              </div>
              <div>
                <label htmlFor="p-answerSourceUrl" className="field-label">
                  Official answers / marking scheme link
                </label>
                <input id="p-answerSourceUrl" name="answerSourceUrl" className="input" defaultValue={editing?.answerSourceUrl ?? ""} placeholder="https://" />
              </div>
              <div>
                <label htmlFor="p-pageCount" className="field-label">
                  Pages
                </label>
                <input id="p-pageCount" name="pageCount" className="input" defaultValue={editing?.pageCount ?? ""} placeholder="" />
              </div>
              <div>
                <label htmlFor="p-maxMarks" className="field-label">
                  Maximum marks
                </label>
                <input id="p-maxMarks" name="maxMarks" className="input" defaultValue={editing?.maxMarks ?? ""} placeholder="80" />
              </div>
              <div>
                <label htmlFor="p-durationMinutes" className="field-label">
                  Duration (minutes)
                </label>
                <input id="p-durationMinutes" name="durationMinutes" className="input" defaultValue={editing?.durationMinutes ?? ""} placeholder="180" />
              </div>
              <div>
                <label htmlFor="p-status" className="field-label">
                  Status
                </label>
                <select id="p-status" name="status" className="select" defaultValue={editing?.status ?? "IMPORTED"}>
                  {SOURCE_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st.replace("_", " ").toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
              </div>
            </details>
            <div>
              <label htmlFor="p-notes" className="field-label">
                Notes
              </label>
              <textarea id="p-notes" name="sourceNotes" className="textarea" rows={3} defaultValue={editing?.sourceNotes} placeholder="Where the copy came from and how it was checked." />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary">
                {editing ? "Save paper" : "Add paper"}
              </button>
              {editing && (
                <Link href="/admin/papers" className="btn btn-ghost">
                  Cancel
                </Link>
              )}
            </div>
          </form>
          {editing && (
            <form action={deletePaperAction} className="mt-5 border-t border-rule pt-4">
              <input type="hidden" name="id" value={editing.id} />
              <label className="flex items-start gap-2 text-[0.93rem]">
                <input type="checkbox" required className="mt-1 size-4 accent-[var(--color-margin)]" />
                <span>Delete this paper. Linked questions lose this source and are set to unverified if it was their only proof.</span>
              </label>
              <button type="submit" className="btn btn-danger btn-sm mt-2">
                Delete paper
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
