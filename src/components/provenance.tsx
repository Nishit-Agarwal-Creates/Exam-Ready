import type { SourceType, VerificationStatus } from "@/db/schema";
import { DEMO_LABEL, PAPER_TYPE_LABELS, SOURCE_LABELS, STATUS_LABELS, frequencyLine, isRealVerifiedPyq, provenanceYears, type SourceLink } from "@/lib/provenance";

type Q = { sourceType: SourceType; verificationStatus: VerificationStatus; isDemo: boolean; sources: SourceLink[] };

const STAMP_CLASS: Record<SourceType, string> = {
  VERIFIED_PYQ: "stamp-verified",
  OFFICIAL_SAMPLE: "stamp-official",
  USER_CONTRIBUTED: "stamp-contrib",
  AI_SUPPLEMENTARY: "stamp-ai",
};

function Tick() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2 6.5 4.8 9 10 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DemoStamp({ compact = false }: { compact?: boolean }) {
  return (
    <span className="stamp stamp-demo" title={DEMO_LABEL}>
      {compact ? "Demo data" : DEMO_LABEL}
    </span>
  );
}

/**
 * The visible provenance stamp. Demo items always show the DEMO label and never a PYQ stamp.
 * A "Verified PYQ" stamp only appears when isRealVerifiedPyq() holds.
 */
export function SourceStamp({ q, compact = false }: { q: Q; compact?: boolean }) {
  if (q.isDemo) return <DemoStamp compact={compact} />;
  if (q.sourceType === "VERIFIED_PYQ") {
    if (isRealVerifiedPyq(q)) {
      const years = provenanceYears(q);
      return (
        <span className="stamp stamp-verified">
          <Tick />
          Verified PYQ{years ? ` ${years}` : ""}
        </span>
      );
    }
    return <span className="stamp stamp-unverified">PYQ claim not verified</span>;
  }
  if (q.verificationStatus === "REJECTED") return <span className="stamp stamp-rejected">Rejected</span>;
  return (
    <span className={`stamp ${STAMP_CLASS[q.sourceType]}`}>
      {q.sourceType === "OFFICIAL_SAMPLE" && q.verificationStatus === "VERIFIED" && <Tick />}
      {SOURCE_LABELS[q.sourceType].short}
      {q.verificationStatus === "UNVERIFIED" && q.sourceType !== "AI_SUPPLEMENTARY" ? ", unverified" : ""}
    </span>
  );
}

export function StatusStamp({ status }: { status: VerificationStatus }) {
  const cls = status === "VERIFIED" ? "stamp-verified" : status === "REJECTED" ? "stamp-rejected" : "stamp-unverified";
  return <span className={`stamp ${cls}`}>{STATUS_LABELS[status]}</span>;
}

/** Expandable provenance details: category, status, each linked source and stored frequency. */
export function ProvenanceDetails({ q }: { q: Q }) {
  const freq = frequencyLine(q);
  return (
    <details className="group mt-3 text-[0.9rem]">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded font-bold text-ink hover:underline [&::-webkit-details-marker]:hidden">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m9 6 6 6-6 6" />
        </svg>
        Source details
      </summary>
      <div className="mt-2 space-y-2 rounded-md border border-rule bg-desk/60 p-3">
        {q.isDemo && (
          <p className="font-bold text-demo">
            {DEMO_LABEL}. This question was written for demonstration. Its category ({SOURCE_LABELS[q.sourceType].short.toLowerCase()}) is only a test label.
          </p>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-pencil">Category</dt>
          <dd>{SOURCE_LABELS[q.sourceType].long}</dd>
          <dt className="text-pencil">Status</dt>
          <dd>{STATUS_LABELS[q.verificationStatus]}</dd>
          <dt className="text-pencil">Sources</dt>
          <dd>
            {q.sources.length === 0 ? (
              <span>No source paper is linked.</span>
            ) : (
              <ul className="space-y-0.5">
                {q.sources.map((s) => (
                  <li key={s.paperId}>
                    {s.sourceUrl ? (
                      <a className="link" href={s.sourceUrl} rel="noopener noreferrer nofollow" target="_blank">
                        {s.title}
                      </a>
                    ) : (
                      s.title
                    )}
                    <span className="text-pencil">
                      {" "}
                      ({PAPER_TYPE_LABELS[s.paperType]}
                      {s.year && !s.isDemo ? `, ${s.year}` : ""}
                      {s.questionNumber ? `, Q${s.questionNumber}` : ""})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </dd>
          {freq && (
            <>
              <dt className="text-pencil">Frequency</dt>
              <dd>{freq}</dd>
            </>
          )}
        </dl>
        {!q.isDemo && <p className="text-pencil">{SOURCE_LABELS[q.sourceType].description}</p>}
      </div>
    </details>
  );
}
