import type { Metadata } from "next";
import Link from "next/link";
import type { PaperType, SourceAuthority } from "@/db/schema";
import { getPublicSources } from "@/lib/data/trends";
import { AUTHORITY_LABELS, PAPER_TYPE_LABELS } from "@/lib/provenance";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Question sources",
  description: "Every source document behind ExamReady's questions: where it came from, how it was extracted, and how many of its questions have been verified.",
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

export default async function SourcesPage() {
  const sources = await getPublicSources();
  return (
    <div className="container-page page-enter py-8 sm:py-12">
      <header className="max-w-3xl">
        <h1 className="text-[2.2rem] sm:text-[2.8rem]">Question sources</h1>
        <p className="mt-3 text-[1.08rem] text-pencil">
          Every previous-year question on ExamReady points back to one of these documents. A source being listed doesn&apos;t mean its questions are verified:
          each question is checked by an editor against the document first.
        </p>
      </header>
      {sources.length === 0 ? (
        <p className="panel mt-8 rounded-2xl p-6 text-pencil">No source documents have been added yet.</p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {sources.map((s, i) => (
            <li key={s.id} data-reveal style={{ ["--d" as string]: `${i * 60}ms` }}>
              <Link href={`/sources/${s.id}`} className="tilt-card block h-full rounded-2xl border border-rule bg-sheet p-5">
                <span className="text-[0.85rem] font-bold text-pencil">
                  {s.board} {s.cls} {s.subject}
                </span>
                <span className="mt-1 block font-serif text-[1.25rem] font-semibold leading-snug">{s.title}</span>
                <span className="mt-2 block text-[0.92rem] text-pencil">
                  {PAPER_TYPE_LABELS[s.paper_type as PaperType]}
                  {s.year ? `, ${s.year}` : ""} · {AUTHORITY_LABELS[s.authority as SourceAuthority]}
                  {s.source_domain ? ` (${s.source_domain})` : ""}
                </span>
                <span className="mt-4 flex flex-wrap gap-2 text-[0.85rem]">
                  <span className="rounded-full bg-desk px-2.5 py-1 font-bold">{s.extracted} extracted</span>
                  <span className={`rounded-full px-2.5 py-1 font-bold ${s.verified ? "bg-verified-soft text-verified" : "bg-pending-soft text-pending"}`}>
                    {s.verified} verified
                  </span>
                  <span className="rounded-full border border-rule px-2.5 py-1">{STATUS_TEXT[s.status] ?? s.status}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
