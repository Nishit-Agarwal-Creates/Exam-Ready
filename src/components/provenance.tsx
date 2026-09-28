import Link from "next/link";
import type { AnswerSource, SourceType, VerificationStatus } from "@/db/schema";
import {
  AUTHORITY_LABELS,
  DEMO_LABEL,
  PAPER_TYPE_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  frequencyLine,
  isRealVerifiedPyq,
  provenanceYears,
  type SourceLink,
} from "@/lib/provenance";

type Q = { sourceType: SourceType; verificationStatus: VerificationStatus; isDemo: boolean; sources: SourceLink[] };

function Tick() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2 6.5 4.8 9 10 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Spark() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 1v3M6 8v3M1 6h3M8 6h3M2.5 2.5l2 2M7.5 7.5l2 2M9.5 2.5l-2 2M4.5 7.5l-2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function Clock() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="6" r="4.5" />
      <path d="M6 3.5V6l1.8 1.2" strokeLinecap="round" />
    </svg>
  );
}

export function DemoStamp({ compact = false }: { compact?: boolean }) {
  return (
    <span className="stamp stamp-demo" title={DEMO_LABEL}>
      {compact ? "Demo · AI practice" : DEMO_LABEL}
    </span>
  );
}

/**
 * The visible provenance stamp. Each category has its own colour, border style and icon so they
 * never look alike. "Verified PYQ" only appears when isRealVerifiedPyq() holds.
 */
export function SourceStamp({ q, compact = false, animate = false }: { q: Q; compact?: boolean; animate?: boolean }) {
  const anim = animate ? " stamp-animate" : "";
  if (q.isDemo) return <DemoStamp compact={compact} />;
  if (q.verificationStatus === "REJECTED") return <span className="stamp stamp-rejected">Rejected</span>;
  if (q.sourceType === "VERIFIED_PYQ") {
    if (isRealVerifiedPyq(q)) {
      const years = provenanceYears(q);
      return (
        <span className={`stamp stamp-verified${anim}`}>
          <Tick />
          Verified PYQ{years ? ` ${years}` : ""}
        </span>
      );
    }
    return (
      <span className="stamp stamp-pending">
        <Clock />
        PYQ · pending review
      </span>
    );
  }
  if (q.sourceType === "AI_SUPPLEMENTARY") {
    return (
      <span className="stamp stamp-ai">
        <Spark />
        AI practice
      </span>
    );
  }
  if (q.sourceType === "PENDING_REVIEW") {
    return (
      <span className="stamp stamp-pending">
        <Clock />
        Pending review
      </span>
    );
  }
  const cls = q.sourceType === "OFFICIAL_SAMPLE" ? "stamp-official" : "stamp-contrib";
  return (
    <span className={`stamp ${cls}${anim}`}>
      {q.verificationStatus === "VERIFIED" && <Tick />}
      {SOURCE_LABELS[q.sourceType].badge}
      {q.verificationStatus === "UNVERIFIED" ? " · pending review" : ""}
    </span>
  );
}

export function StatusStamp({ status }: { status: VerificationStatus }) {
  const cls = status === "VERIFIED" ? "stamp-verified" : status === "REJECTED" ? "stamp-rejected" : "stamp-pending";
  return <span className={`stamp ${cls}`}>{STATUS_LABELS[status]}</span>;
}

const ANSWER_SOURCE_TEXT: Record<AnswerSource, string> = {
  OFFICIAL_SCHEME: "Answer from the official marking scheme",
  EDITOR: "Answer written by an ExamReady editor",
  AI: "Answer written by AI",
  NONE: "No official answer published",
};

/** A compact provenance summary: only fields that exist are shown. */
export function ProvenanceSummary({ q, board, cls, subject }: { q: Q; board?: string; cls?: string; subject?: string }) {
  const primary = q.sources.find((s) => !s.isDemo && s.paperType === "BOARD_EXAM") ?? q.sources.find((s) => !s.isDemo);
  if (!primary || q.isDemo) return null;
  const rows: [string, string][] = [];
  if (primary.boardName ?? board) rows.push(["Board", (primary.boardName ?? board)!]);
  if (cls) rows.push(["Class", cls]);
  if (subject) rows.push(["Subject", subject]);
  if (primary.year) rows.push(["Year", String(primary.year)]);
  rows.push(["Paper", [PAPER_TYPE_LABELS[primary.paperType], primary.paperCode ? `Q.P. ${primary.paperCode}` : null].filter(Boolean).join(", ")]);
  if (primary.questionNumber) rows.push(["Question", `${primary.questionNumber}${primary.part ?? ""}`]);
  if (primary.pageNumber) rows.push(["Page", String(primary.pageNumber)]);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.88rem]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-pencil">{k}</dt>
          <dd className="font-bold">{v}</dd>
        </div>
      ))}
      <dt className="text-pencil">Status</dt>
      <dd className={isRealVerifiedPyq(q) ? "font-bold text-verified" : "font-bold text-pending"}>{isRealVerifiedPyq(q) ? "Source verified" : "Awaiting source review"}</dd>
    </dl>
  );
}

/** Expandable provenance details: category, status, each linked source, stored frequency and extraction notes. */
export function ProvenanceDetails({
  q,
  groupSources,
  answerSource,
  issues = [],
}: {
  q: Q;
  groupSources?: SourceLink[];
  answerSource?: AnswerSource;
  issues?: string[];
}) {
  const freq = frequencyLine(q, groupSources ?? q.sources);
  return (
    <details className="group mt-3 text-[0.9rem]">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded font-bold text-ink hover:underline [&::-webkit-details-marker]:hidden">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m9 6 6 6-6 6" />
        </svg>
        Source details
      </summary>
      <div className="expand-in mt-2 space-y-2 rounded-xl border border-rule bg-desk/60 p-3">
        {q.isDemo && (
          <p className="font-bold text-demo">
            {DEMO_LABEL}. This question was written by AI for demonstration. It has never appeared in an exam.
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
              <span>No source document is linked. It makes no past-paper claim.</span>
            ) : (
              <ul className="space-y-1">
                {q.sources.map((s) => (
                  <li key={s.paperId}>
                    <Link className="link" href={`/sources/${s.paperId}`}>
                      {s.title}
                    </Link>
                    <span className="block text-pencil">
                      {[
                        s.authority ? AUTHORITY_LABELS[s.authority] : PAPER_TYPE_LABELS[s.paperType],
                        s.year && !s.isDemo ? String(s.year) : null,
                        s.questionNumber ? `Q${s.questionNumber}${s.part ?? ""}` : null,
                        s.pageNumber ? `page ${s.pageNumber}` : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}
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
          {answerSource && (
            <>
              <dt className="text-pencil">Answer</dt>
              <dd>{ANSWER_SOURCE_TEXT[answerSource]}</dd>
            </>
          )}
        </dl>
        {issues.length > 0 && (
          <div className="rounded-lg border border-contrib/30 bg-contrib-soft/60 px-3 py-2">
            <p className="font-bold text-contrib">Extraction notes</p>
            <ul className="mt-1 list-disc pl-5 text-[0.88rem]">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        )}
        {!q.isDemo && <p className="text-pencil">{SOURCE_LABELS[q.sourceType].description}</p>}
      </div>
    </details>
  );
}
