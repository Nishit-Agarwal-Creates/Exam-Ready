import Link from "next/link";
import registry from "@/data/source-registry.json";
import { getSourceQueues, sumQueues } from "@/lib/data/research";
import { PAPER_TYPE_LABELS } from "@/lib/provenance";
import type { PaperType } from "@/db/schema";

export const metadata = { title: "Research centre" };

function Num({ n, warn = false }: { n: number; warn?: boolean }) {
  return <span className={`num ${n ? (warn ? "font-bold text-contrib" : "font-bold") : "text-pencil/60"}`}>{n}</span>;
}

export default async function ResearchPage() {
  const queues = await getSourceQueues();
  const t = sumQueues(queues);
  const checks: [string, number, string][] = [
    ["ready for review", t.pending, "/admin/review"],
    ["have formula or symbol-loss notes", t.formulaLoss, "/admin/questions?status=UNVERIFIED&issues=any&demo=exclude"],
    ["need a figure that isn't reproduced", t.figure, "/admin/questions?status=UNVERIFIED&issues=figure&demo=exclude"],
    ["have low extraction confidence", t.lowConfidence, "/admin/questions?status=UNVERIFIED&issues=low&demo=exclude"],
    ["have no official answer", t.noAnswer, "/admin/questions?status=UNVERIFIED&demo=exclude"],
    ["have an official answer that is partly missing", t.answerPartial, "/admin/questions?status=UNVERIFIED&issues=any&demo=exclude"],
    ["have a suggested chapter to confirm", t.suggestedMapping, "/admin/review"],
  ];
  return (
    <div>
      <h1 className="text-[2rem]">Research centre</h1>
      <p className="prose-width mt-2 text-pencil">
        Where the official material comes from, what has been imported, and what still needs an editor. Nothing here verifies anything: questions stay
        pending until they are checked against the source in the review queue.
      </p>

      <section className="panel mt-6 rounded-2xl p-5" aria-labelledby="checks-title">
        <h2 id="checks-title" className="font-sans text-[1.1rem] font-bold">
          Review workload
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map(([label, n, href]) => (
            <li key={label}>
              <Link href={href} className="fx-lift flex items-baseline gap-2 rounded-xl border border-rule bg-desk/50 px-4 py-3 hover:border-ink-line">
                <span className={`num font-serif text-[1.6rem] font-semibold ${n ? "text-ink" : "text-pencil/60"}`}>{n}</span>
                <span className="text-[0.95rem]">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.88rem] text-pencil">
          {t.verified} verified and {t.rejected} rejected so far, out of {t.total} imported official questions.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="queue-title">
        <h2 id="queue-title" className="font-sans text-[1.1rem] font-bold">
          Import and review queue by source document
        </h2>
        <div className="panel mt-3 overflow-x-auto">
          <table className="table min-w-[62rem]">
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col" className="text-right">
                  Imported
                </th>
                <th scope="col" className="text-right">
                  Pending
                </th>
                <th scope="col" className="text-right">
                  Verified
                </th>
                <th scope="col" className="text-right">
                  Formula notes
                </th>
                <th scope="col" className="text-right">
                  Figures
                </th>
                <th scope="col" className="text-right">
                  Low confidence
                </th>
                <th scope="col" className="text-right">
                  No answer
                </th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {queues.map((q) => (
                <tr key={q.paperId}>
                  <th scope="row" className="!font-normal !text-graphite">
                    <span className="block font-bold">{q.title}</span>
                    <span className="block text-sm text-pencil">
                      {q.board} {q.cls} {q.subject}, {PAPER_TYPE_LABELS[q.paperType as PaperType] ?? q.paperType}
                    </span>
                  </th>
                  <td className="text-right">
                    <Num n={q.total} />
                  </td>
                  <td className="text-right">
                    <Num n={q.pending} />
                  </td>
                  <td className="text-right">
                    <Num n={q.verified} />
                  </td>
                  <td className="text-right">
                    <Num n={q.formulaLoss} warn />
                  </td>
                  <td className="text-right">
                    <Num n={q.figure} warn />
                  </td>
                  <td className="text-right">
                    <Num n={q.lowConfidence} warn />
                  </td>
                  <td className="text-right">
                    <Num n={q.noAnswer} warn />
                  </td>
                  <td>
                    {q.pending > 0 ? (
                      <Link href={`/admin/review?paper=${q.paperId}`} className="btn btn-secondary btn-sm">
                        Review
                      </Link>
                    ) : (
                      <span className="text-sm text-pencil">Done</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="registry-title">
        <h2 id="registry-title" className="font-sans text-[1.1rem] font-bold">
          Official sources found (checked {registry.checkedOn})
        </h2>
        <ul className="mt-3 grid gap-3 lg:grid-cols-2">
          {registry.sources.map((s) => (
            <li key={s.id} className="panel rounded-2xl p-4">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{s.kind}</span>
                <span className={`stamp ${s.access === "OPEN" ? "stamp-verified" : "stamp-rejected"}`}>{s.access === "OPEN" ? "Publicly available" : "Restricted"}</span>
              </p>
              <p className="text-sm text-pencil">{s.authority}</p>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="link mt-1 block break-all text-[0.9rem]">
                {s.url}
              </a>
              <p className="mt-2 text-[0.92rem]">{s.coverage}</p>
              {s.notes && <p className="mt-2 rounded-lg bg-contrib-soft/60 px-3 py-2 text-[0.88rem] text-contrib">{s.notes}</p>}
            </li>
          ))}
        </ul>
        <h3 className="mt-6 font-bold">Not imported yet</h3>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-[0.95rem]">
          {registry.notImported.map((n) => (
            <li key={n.what}>
              <strong>{n.what}.</strong> <span className="text-pencil">{n.why}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[0.9rem] text-pencil">
          To add a document: download it from the official page, then use{" "}
          <Link href="/admin/import" className="link">
            Import
          </Link>{" "}
          (PDF text layer or OCR in your browser). Source packs in <code>src/data/sources</code> are checked with{" "}
          <code>node scripts/check-sources.mjs</code>.
        </p>
      </section>
    </div>
  );
}
