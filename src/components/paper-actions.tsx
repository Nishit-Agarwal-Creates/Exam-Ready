"use client";

import Link from "next/link";
import { useState } from "react";
import type { PaperView } from "@/lib/data/papers";

type Stage = "questions" | "pages" | "done";
const STAGE_TEXT: Record<Stage, string> = {
  questions: "Collecting the questions",
  pages: "Laying out the pages",
  done: "Your PDF is downloading",
};

/** Questions → pages → paper stack → document. Each stage is a real step of building the PDF. */
function PdfBuild({ stage }: { stage: Stage }) {
  return (
    <div className="pdf-build" data-stage={stage} role="status" aria-live="polite">
      <svg viewBox="0 0 120 70" width="120" height="70" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <g key={i} className="pdf-sheet" style={{ ["--i" as string]: i }}>
            <rect x="38" y="8" width="44" height="54" rx="4" fill="#fff" stroke="#a9b0c7" />
            <path d="M46 20h28M46 28h22M46 36h26M46 44h18" stroke="#bcc4f5" strokeWidth="2.4" strokeLinecap="round" />
          </g>
        ))}
        <g className="pdf-done">
          <circle cx="82" cy="54" r="10" fill="#0f7a4d" />
          <path d="m77 54 3.5 3.5L87 51" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
      <span className="text-[0.92rem] font-bold">{STAGE_TEXT[stage]}</span>
    </div>
  );
}

export function PaperActions({ paperId, showAnswers }: { paperId: string; showAnswers: boolean }) {
  const [busy, setBusy] = useState<null | "plain" | "answers">(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(withAnswers: boolean) {
    setBusy(withAnswers ? "answers" : "plain");
    setStage("questions");
    setError(null);
    try {
      const res = await fetch(`/api/papers/${paperId}${withAnswers ? "?answers=1" : ""}`);
      if (!res.ok) throw new Error();
      const paper = (await res.json()) as PaperView;
      setStage("pages");
      const { downloadPaperPdf } = await import("@/lib/pdf");
      await downloadPaperPdf(paper, withAnswers);
      setStage("done");
      setTimeout(() => setStage(null), 2200);
    } catch {
      setStage(null);
      setError("The PDF couldn't be created. Check your connection and try again.");
    }
    setBusy(null);
  }

  return (
    <div className="mt-3 grid gap-2">
      <Link href={`/test/${paperId}`} className="btn btn-primary fx-sweep" data-fx="pulse">
        Start online test
      </Link>
      <button type="button" className="btn btn-secondary" onClick={() => download(false)} disabled={busy !== null} data-fx="ripple">
        {busy === "plain" ? "Creating PDF…" : "Download PDF"}
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => download(true)} disabled={busy !== null} data-fx="ripple">
        {busy === "answers" ? "Creating PDF…" : "Download PDF with answers"}
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
        Print this page
      </button>
      <Link href={showAnswers ? `/paper/${paperId}` : `/paper/${paperId}?answers=1`} className="btn btn-ghost" scroll={false}>
        {showAnswers ? "Hide model answers" : "Show model answers"}
      </Link>
      {stage && <PdfBuild stage={stage} />}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <p className="mt-1 text-[0.88rem] text-pencil">Tip: take the online test before looking at the answers.</p>
    </div>
  );
}
