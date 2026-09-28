import Link from "next/link";
import registry from "@/data/source-registry.json";
import pipeline from "@/data/reviews/summary.json";
import { getReviewOverview, getSourceQueues, sumQueues } from "@/lib/data/research";
import { PAPER_TYPE_LABELS, REVIEW_STATE_LABELS } from "@/lib/provenance";
import type { PaperType } from "@/db/schema";

export const metadata = { title: "Research centre" };

function Num({ n, warn = false }: { n: number; warn?: boolean }) {
  return <span className={`num ${n ? (warn ? "font-bold text-contrib" : "font-bold") : "text-pencil/60"}`}>{n}</span>;
}

const HOLDS = ["HOLD_RIGHTS", "HOLD_MISSING_FIGURE", "HOLD_ANSWER", "HOLD_LOW_CONFIDENCE", "HOLD_MAPPING", "HOLD_AUDIT", "HOLD_MISSING_SOURCE"] as const;

type PackSummary = { pack: string; reviewed: boolean; audit?: { sampled: number; disputed: number; heldPack: boolean } | null };

export default async function ResearchPage() {
  const [queues, overview] = await Promise.all([getSourceQueues(), getReviewOverview()]);
  const t = sumQueues(queues);
  const st = overview.states;
  const held = HOLDS.reduce((n, h) => n + (st[h] ?? 0), 0);
  const rejected = (st.REJECTED_DUPLICATE ?? 0) + (st.REJECTED_INVALID ?? 0);
  const pipelineBar: [string, number, string][] = [
    ["Verified by automated review", st.AUTO_VERIFIED ?? 0, "bg-verified"],
    ["Verified by an editor", st.EDITOR_VERIFIED ?? 0, "bg-ink"],
    ["Held with a reason", held, "bg-contrib"],
    ["Awaiting review", st.PENDING_REVIEW ?? 0, "bg-pending"],
    ["Rejected", rejected, "bg-rejected"],
  ];
  const barTotal = pipelineBar.reduce((n, [, v]) => n + v, 0) || 1;
  const packs = (pipeline.packs as PackSummary[]) ?? [];
  const reviewedPacks = packs.filter((p) => p.reviewed).length;
  const auditedPacks = packs.filter((p) => p.audit).length;
  const disputes = packs.reduce((n, p) => n + (p.audit?.disputed ?? 0), 0);
  const sampled = packs.reduce((n, p) => n + (p.audit?.sampled ?? 0), 0);
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
        Where the official material comes from, what the automated review decided, and what still needs an editor. Every held question carries the
        reason it was held; nothing is published without matching its official document.
      </p>

      <section className="panel mt-6 rounded-2xl p-5" aria-labelledby="pipeline-title">
        <h2 id="pipeline-title" className="font-sans text-[1.1rem] font-bold">
          Review pipeline
        </h2>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-desk-deep" role="img" aria-label={pipelineBar.map(([l, n]) => `${l}: ${n}`).join(", ")}>
          {pipelineBar.map(([l, n, c]) => (n ? <span key={l} className={c} style={{ width: `${(n / barTotal) * 100}%` }} /> : null))}
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {pipelineBar.map(([l, n, c]) => (
            <li key={l} className="flex items-baseline gap-2">
              <span className={`inline-block size-2.5 shrink-0 rounded-full ${c}`} aria-hidden="true" />
              <span className="num font-serif text-[1.5rem] font-semibold">{n}</span>
              <span className="text-[0.9rem] text-pencil">{l}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[0.9rem] text-pencil">
          {reviewedPacks} of {packs.length} source documents reviewed question by question; {auditedPacks} re-checked by an independent second reviewer (
          {sampled} decisions sampled, {disputes} disputed). Last consolidated {pipeline.generatedOn}. Run{" "}
          <code>node scripts/review/consolidate.mjs</code> after new reviews, then apply <code>drizzle/seed/review.sql</code>.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="holds-title">
        <h2 id="holds-title" className="font-sans text-[1.1rem] font-bold">
          Held questions, by reason
        </h2>
        <ul className="mt-3 grid gap-3 lg:grid-cols-2">
          {HOLDS.map((h) => {
            const n = st[h] ?? 0;
            const top = overview.reasons.filter((r) => r.state === h).slice(0, 3);
            return (
              <li key={h} className="panel rounded-2xl p-4">
                <Link href={`/admin/questions?review=${h}&demo=exclude`} className="group flex items-baseline gap-3">
                  <span className={`num font-serif text-[1.7rem] font-semibold ${n ? "text-contrib" : "text-pencil/60"}`}>{n}</span>
                  <span className="font-bold group-hover:underline">{REVIEW_STATE_LABELS[h].label}</span>
                </Link>
                <p className="mt-1 text-[0.9rem] text-pencil">{REVIEW_STATE_LABELS[h].explain}</p>
                {top.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-rule pt-2 text-[0.86rem]">
                    {top.map((r) => (
                      <li key={r.reason} className="flex gap-2">
                        <span className="num shrink-0 font-bold">{r.n}</span>
                        <span className="line-clamp-2">{r.reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel mt-8 rounded-2xl p-5" aria-labelledby="checks-title">
        <h2 id="checks-title" className="font-sans text-[1.1rem] font-bold">
          Still awaiting review
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
          <table className="table min-w-[72rem]">
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
                  Auto-verified
                </th>
                <th scope="col" className="text-right">
                  Editor-verified
                </th>
                <th scope="col" className="text-right">
                  Held
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
                    <Num n={overview.byPaper.get(q.paperId)?.auto ?? 0} />
                  </td>
                  <td className="text-right">
                    <Num n={overview.byPaper.get(q.paperId)?.editor ?? 0} />
                  </td>
                  <td className="text-right">
                    <Num n={overview.byPaper.get(q.paperId)?.held ?? 0} warn />
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
                {"reuse" in s && s.reuse === "LINK_ONLY" && <span className="stamp stamp-pending">Link only, not reproduced</span>}
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
