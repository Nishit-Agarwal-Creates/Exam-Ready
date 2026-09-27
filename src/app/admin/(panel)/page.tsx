import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { SOURCE_TYPES, VERIFICATION_STATUSES } from "@/db/schema";
import { getDashboard } from "@/lib/data/admin";
import { SOURCE_LABELS, STATUS_LABELS } from "@/lib/provenance";
import { purgeDemoAction } from "../actions";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const d = await getDashboard();
  const count = (source: string, status: string, demo?: boolean) =>
    d.bySource.filter((r) => r.sourceType === source && r.status === status && (demo === undefined || r.isDemo === demo)).reduce((s, r) => s + r.n, 0);
  const total = d.bySource.reduce((s, r) => s + r.n, 0);
  const demoTotal = d.bySource.filter((r) => r.isDemo).reduce((s, r) => s + r.n, 0);
  const unverified = d.bySource.filter((r) => r.status === "UNVERIFIED").reduce((s, r) => s + r.n, 0);
  const realPyq = count("VERIFIED_PYQ", "VERIFIED", false);

  return (
    <div>
      <Flash saved={sp.saved} error={sp.error} />
      <h1 className="text-[2rem]">Dashboard</h1>

      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Questions", total, "/admin/questions"],
          ["Real verified PYQs", realPyq, "/admin/questions?source=VERIFIED_PYQ&status=VERIFIED&demo=exclude"],
          ["Awaiting verification", unverified, "/admin/questions?status=UNVERIFIED"],
          ["Import items to review", d.pendingImports, "/admin/import"],
          ["Source papers", d.papers, "/admin/papers"],
          ["Tests submitted", d.attempts, "/admin/generated"],
        ].map(([label, n, href]) => (
          <div key={label as string} className="panel p-4">
            <dt className="text-sm text-pencil">{label}</dt>
            <dd className="num mt-1 font-serif text-[1.8rem] font-semibold leading-none">
              <Link href={href as string} className="hover:text-ink hover:underline">
                {n}
              </Link>
            </dd>
          </div>
        ))}
      </dl>

      <section className="mt-8 panel overflow-x-auto" aria-labelledby="prov-title">
        <h2 id="prov-title" className="px-4 pt-4 font-sans text-[1.1rem] font-bold">
          Provenance breakdown
        </h2>
        <table className="table mt-2">
          <thead>
            <tr>
              <th scope="col">Source category</th>
              {VERIFICATION_STATUSES.map((s) => (
                <th key={s} scope="col" className="text-right">
                  {STATUS_LABELS[s]}
                </th>
              ))}
              <th scope="col" className="text-right">
                Of which demo
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
                    <Link href={`/admin/questions?source=${src}&status=${st}`} className="hover:underline">
                      {count(src, st)}
                    </Link>
                  </td>
                ))}
                <td className="num text-right text-demo">{d.bySource.filter((r) => r.sourceType === src && r.isDemo).reduce((s, r) => s + r.n, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8 panel overflow-x-auto" aria-labelledby="subj-title">
        <h2 id="subj-title" className="px-4 pt-4 font-sans text-[1.1rem] font-bold">
          Coverage by subject
        </h2>
        <table className="table mt-2">
          <thead>
            <tr>
              <th scope="col">Subject</th>
              <th scope="col" className="text-right">
                Questions
              </th>
              <th scope="col" className="text-right">
                Verified
              </th>
              <th scope="col" className="text-right">
                Real verified PYQs
              </th>
            </tr>
          </thead>
          <tbody>
            {d.bySubject.map((s) => (
              <tr key={s.subjectId}>
                <th scope="row" className="font-normal">
                  <Link href={`/admin/questions?subject=${s.subjectId}`} className="hover:underline">
                    {s.cls} {s.subject}
                  </Link>
                </th>
                <td className="num text-right">{s.n}</td>
                <td className="num text-right">{s.verified}</td>
                <td className="num text-right">{s.realPyq}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {demoTotal > 0 && (
        <section className="mt-8 rounded-md border-2 border-margin/50 bg-sheet p-5" aria-labelledby="demo-title">
          <h2 id="demo-title" className="font-sans text-[1.1rem] font-bold">
            Remove demo data
          </h2>
          <p className="mt-1 max-w-2xl text-pencil">
            {demoTotal} demo questions are in the bank. Before launch, delete them together with their fictional papers and any generated papers and attempts
            that used them. This can&apos;t be undone. Locally, <code>npm run db:reset</code> brings them back.
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
