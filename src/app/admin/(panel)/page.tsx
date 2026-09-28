import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { SOURCE_TYPES, VERIFICATION_STATUSES } from "@/db/schema";
import { getAnalytics } from "@/lib/data/admin";
import { SOURCE_LABELS, STATUS_LABELS } from "@/lib/provenance";
import { purgeDemoAction } from "../actions";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const a = await getAnalytics();
  const t = a.totals;
  const count = (src: string, st: string, demo?: boolean) =>
    a.provenance.filter((r) => r.sourceType === src && r.status === st && (demo === undefined || r.isDemo === demo)).reduce((s, r) => s + r.n, 0);
  const demoTotal = a.provenance.filter((r) => r.isDemo).reduce((s, r) => s + r.n, 0);

  const tiles: [string, number, string][] = [
    ["Verified PYQs", t.realVerifiedPyq, "/admin/questions?source=VERIFIED_PYQ&status=VERIFIED&demo=exclude"],
    ["Pending review", t.pendingReview, "/admin/review"],
    ["Rejected", t.rejected, "/admin/questions?status=REJECTED"],
    ["Source documents", t.sources, "/admin/papers"],
    ["Duplicate groups", t.duplicateGroups, "/admin/duplicates"],
    ["Needs a figure", t.figures, "/admin/questions?issues=figure&demo=exclude"],
    ["Low OCR / extraction confidence", t.lowConfidence, "/admin/questions?issues=low&demo=exclude"],
    ["Suggested chapter mappings", t.suggestedMappings, "/admin/review"],
    ["Import items to review", t.pendingImports, "/admin/import"],
    ["AI practice questions", t.ai, "/admin/questions?source=AI_SUPPLEMENTARY"],
  ];

  return (
    <div>
      <Flash saved={sp.saved} error={sp.error} />
      <h1 className="text-[2rem]">Dashboard</h1>
      <p className="mt-1 text-pencil">Every number below is a live count of stored rows.</p>

      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map(([label, n, href]) => (
          <div key={label} className="panel rounded-2xl p-4">
            <dt className="text-sm text-pencil">{label}</dt>
            <dd className="num mt-1 font-serif text-[1.8rem] font-semibold leading-none">
              <Link href={href} className="hover:text-ink hover:underline">
                {n}
              </Link>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="panel overflow-x-auto rounded-2xl" aria-labelledby="prov-title">
          <h2 id="prov-title" className="px-4 pt-4 font-sans text-[1.1rem] font-bold">
            Provenance distribution
          </h2>
          <table className="table mt-2">
            <thead>
              <tr>
                <th scope="col">Category</th>
                {VERIFICATION_STATUSES.map((s) => (
                  <th key={s} scope="col" className="text-right">
                    {STATUS_LABELS[s]}
                  </th>
                ))}
                <th scope="col" className="text-right">
                  Demo
                </th>
              </tr>
            </thead>
            <tbody>
              {SOURCE_TYPES.map((src) => (
                <tr key={src}>
                  <th scope="row" className="font-bold">
                    <Link href={`/admin/questions?source=${src}`} className="hover:underline">
                      {SOURCE_LABELS[src].short}
                    </Link>
                  </th>
                  {VERIFICATION_STATUSES.map((st) => (
                    <td key={st} className="num text-right">
                      {count(src, st, false)}
                    </td>
                  ))}
                  <td className="num text-right text-demo">{a.provenance.filter((r) => r.sourceType === src && r.isDemo).reduce((s, r) => s + r.n, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel overflow-x-auto rounded-2xl" aria-labelledby="year-title">
          <h2 id="year-title" className="px-4 pt-4 font-sans text-[1.1rem] font-bold">
            Board-paper questions by exam year
          </h2>
          <table className="table mt-2">
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col">Board</th>
                <th scope="col" className="text-right">
                  Verified
                </th>
                <th scope="col" className="text-right">
                  Pending
                </th>
              </tr>
            </thead>
            <tbody>
              {a.byYear.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-pencil">
                    No board-paper questions yet.
                  </td>
                </tr>
              )}
              {a.byYear.map((r) => (
                <tr key={`${r.year}-${r.board}`}>
                  <td className="num">{r.year}</td>
                  <td>{r.board}</td>
                  <td className="num text-right">{r.verified}</td>
                  <td className="num text-right">{r.pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 pb-3 text-[0.82rem] text-pencil">Duplicate groups count once.</p>
        </section>
      </div>

      <section className="panel mt-6 overflow-x-auto rounded-2xl" aria-labelledby="subj-title">
        <h2 id="subj-title" className="px-4 pt-4 font-sans text-[1.1rem] font-bold">
          Questions by board, class and subject
        </h2>
        <table className="table mt-2 min-w-[40rem]">
          <thead>
            <tr>
              <th scope="col">Subject</th>
              <th scope="col" className="text-right">
                All questions
              </th>
              <th scope="col" className="text-right">
                Verified PYQs
              </th>
              <th scope="col" className="text-right">
                Pending
              </th>
              <th scope="col" className="text-right">
                AI practice
              </th>
            </tr>
          </thead>
          <tbody>
            {a.bySubject
              .filter((s) => s.total > 0)
              .map((s) => (
                <tr key={s.subject_id}>
                  <th scope="row" className="font-normal">
                    <Link href={`/admin/questions?subject=${s.subject_id}`} className="hover:underline">
                      {s.board} {s.cls} {s.subject}
                    </Link>
                  </th>
                  <td className="num text-right">{s.total}</td>
                  <td className="num text-right">{s.real_pyq}</td>
                  <td className="num text-right">{s.pending}</td>
                  <td className="num text-right">{s.ai}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="px-4 pb-3 text-[0.82rem] text-pencil">{a.bySubject.filter((s) => s.total === 0).length} other subjects have no questions yet.</p>
      </section>

      {demoTotal > 0 && (
        <section className="mt-8 rounded-2xl border-2 border-margin/50 bg-sheet p-5" aria-labelledby="demo-title">
          <h2 id="demo-title" className="font-sans text-[1.1rem] font-bold">
            Remove demo data
          </h2>
          <p className="mt-1 max-w-2xl text-pencil">
            {demoTotal} demo questions (AI-written, labelled demo) are in the bank. Before launch you can delete them together with any generated papers and
            attempts that used them. This can&apos;t be undone. Locally, <code>npm run db:reset</code> brings them back.
          </p>
          <form action={purgeDemoAction} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div>
              <label htmlFor="confirm" className="field-label">
                Type DELETE DEMO DATA to confirm
              </label>
              <input id="confirm" name="confirm" className="input sm:w-72" autoComplete="off" required />
            </div>
            <button type="submit" className="btn btn-danger">
              Delete all demo data
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
