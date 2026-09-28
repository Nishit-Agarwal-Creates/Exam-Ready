import type { Metadata } from "next";
import Link from "next/link";
import type { PaperType, SourceAuthority } from "@/db/schema";
import { getPublicSources } from "@/lib/data/trends";
import { one, type SearchParams } from "@/lib/filters";
import { AUTHORITY_LABELS, PAPER_TYPE_LABELS } from "@/lib/provenance";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Question sources",
  description:
    "Every official document behind ExamReady's questions: board exam papers, marking schemes and specimen papers from CBSE and CISCE, with how many of their questions have been verified.",
  path: "/sources",
});

const STATUS_TEXT: Record<string, string> = {
  DISCOVERED: "Found, not yet imported",
  IMPORTED: "Imported",
  EXTRACTED: "Questions extracted",
  PENDING_REVIEW: "Awaiting editor review",
  VERIFIED: "Verified",
  PUBLISHED: "Verified and published",
  REJECTED: "Rejected",
};

const TYPES: [string, string][] = [
  ["all", "All documents"],
  ["board", "Board exam papers"],
  ["sample", "Sample and specimen papers"],
];

export default async function SourcesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const all = await getPublicSources();
  const boards = [...new Set(all.map((s) => s.board))];
  const board = boards.includes(one(sp.board)) ? one(sp.board) : "";
  const type = TYPES.some(([t]) => t === one(sp.type)) ? one(sp.type) : "all";
  const sources = all.filter(
    (s) => (!board || s.board === board) && (type === "all" || (type === "board" ? s.paper_type === "BOARD_EXAM" : s.paper_type === "SAMPLE" || s.paper_type === "SPECIMEN")),
  );
  const groups = new Map<string, typeof sources>();
  for (const s of sources) {
    const k = `${s.board} ${s.cls}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const href = (o: { board?: string; type?: string }) => {
    const q = new URLSearchParams();
    const b = o.board ?? board;
    const t = o.type ?? type;
    if (b) q.set("board", b);
    if (t !== "all") q.set("type", t);
    const s = q.toString();
    return `/sources${s ? `?${s}` : ""}`;
  };
  const boardExams = all.filter((s) => s.paper_type === "BOARD_EXAM").length;

  return (
    <div className="container-page page-enter py-8 sm:py-12">
      <header className="max-w-3xl">
        <h1 className="text-[2.2rem] sm:text-[2.8rem]">Question sources</h1>
        <p className="mt-3 text-[1.08rem] text-pencil">
          Every question on ExamReady that claims an official origin points back to one of these documents, published by the board itself. A document being
          listed doesn&apos;t mean its questions are verified: each question is checked by an editor against the document first.
        </p>
        <p className="mt-3 text-[0.98rem]">
          <strong className="num">{all.length}</strong> documents: <strong className="num">{boardExams}</strong> board exam papers and{" "}
          <strong className="num">{all.length - boardExams}</strong> sample or specimen papers. ExamReady keeps expanding this archive; what isn&apos;t here
          yet is shown on the{" "}
          <Link href="/coverage" className="link">
            coverage page
          </Link>
          .
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filter sources">
        <Link href={href({ board: "" })} className={`chip-link ${!board ? "!border-ink !bg-ink !text-white" : ""}`} aria-current={!board ? "page" : undefined}>
          All boards
        </Link>
        {boards.map((b) => (
          <Link key={b} href={href({ board: b })} className={`chip-link ${board === b ? "!border-ink !bg-ink !text-white" : ""}`} aria-current={board === b ? "page" : undefined}>
            {b}
          </Link>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-rule sm:inline-block" aria-hidden="true" />
        {TYPES.map(([t, label]) => (
          <Link key={t} href={href({ type: t })} className={`chip-link ${type === t ? "!border-ink !bg-ink !text-white" : ""}`} aria-current={type === t ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </div>

      {sources.length === 0 ? (
        <p className="panel mt-8 rounded-2xl p-6 text-pencil">No documents match these filters.</p>
      ) : (
        [...groups.entries()].map(([group, list]) => (
          <section key={group} className="mt-10" aria-labelledby={`g-${group}`}>
            <h2 id={`g-${group}`} className="text-[1.5rem]">
              {group}
            </h2>
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {list.map((s) => (
                <li key={s.id}>
                  <Link href={`/sources/${s.id}`} className="tilt-card block h-full rounded-2xl border border-rule bg-sheet p-5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`stamp ${s.paper_type === "BOARD_EXAM" ? "stamp-verified" : "stamp-official"}`}>
                        {PAPER_TYPE_LABELS[s.paper_type as PaperType]}
                        {s.year ? ` ${s.year}` : ""}
                      </span>
                      <span className="text-[0.85rem] font-bold text-pencil">{s.subject}</span>
                    </span>
                    <span className="mt-2 block font-serif text-[1.2rem] font-semibold leading-snug">{s.title}</span>
                    <span className="mt-2 block text-[0.9rem] text-pencil">
                      {s.authority_name ?? AUTHORITY_LABELS[s.authority as SourceAuthority]}
                      {s.source_domain ? ` (${s.source_domain})` : ""}
                    </span>
                    <span className="mt-4 flex flex-wrap gap-2 text-[0.85rem]">
                      <span className="rounded-full bg-desk px-2.5 py-1 font-bold">{s.extracted} questions imported</span>
                      <span className={`rounded-full px-2.5 py-1 font-bold ${s.verified ? "bg-verified-soft text-verified" : "bg-pending-soft text-pending"}`}>
                        {s.verified} verified
                      </span>
                      <span className="rounded-full border border-rule px-2.5 py-1">{STATUS_TEXT[s.status] ?? s.status}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <section className="panel mt-12 max-w-3xl rounded-2xl p-5" aria-labelledby="not-here">
        <h2 id="not-here" className="font-sans text-[1.1rem] font-bold">
          What isn&apos;t here
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.95rem] text-pencil">
          <li>Past ICSE and ISC board papers: CISCE sells these in print and doesn&apos;t publish them online, so ICSE/ISC questions here are official specimen questions, not PYQs.</li>
          <li>Figures, maps and diagrams from the papers: they aren&apos;t reproduced. Questions that need one link to the page of the source document.</li>
          <li>Scanned papers without a text layer are held back until they can be transcribed and checked.</li>
        </ul>
      </section>
    </div>
  );
}
