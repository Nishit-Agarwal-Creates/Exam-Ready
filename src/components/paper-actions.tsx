"use client";

import Link from "next/link";
import { useState } from "react";
import type { PaperView } from "@/lib/data/papers";

export function PaperActions({ paperId, showAnswers }: { paperId: string; showAnswers: boolean }) {
  const [busy, setBusy] = useState<null | "plain" | "answers">(null);
  const [error, setError] = useState<string | null>(null);

  async function download(withAnswers: boolean) {
    setBusy(withAnswers ? "answers" : "plain");
    setError(null);
    try {
      const res = await fetch(`/api/papers/${paperId}${withAnswers ? "?answers=1" : ""}`);
      if (!res.ok) throw new Error();
      const paper = (await res.json()) as PaperView;
      const { downloadPaperPdf } = await import("@/lib/pdf");
      await downloadPaperPdf(paper, withAnswers);
    } catch {
      setError("The PDF couldn't be created. Check your connection and try again.");
    }
    setBusy(null);
  }

  return (
    <div className="mt-3 grid gap-2">
      <Link href={`/test/${paperId}`} className="btn btn-primary">
        Start online test
      </Link>
      <button type="button" className="btn btn-secondary" onClick={() => download(false)} disabled={busy !== null}>
        {busy === "plain" ? "Creating PDF…" : "Download PDF"}
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => download(true)} disabled={busy !== null}>
        {busy === "answers" ? "Creating PDF…" : "Download PDF with answers"}
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
        Print this page
      </button>
      <Link href={showAnswers ? `/paper/${paperId}` : `/paper/${paperId}?answers=1`} className="btn btn-ghost" scroll={false}>
        {showAnswers ? "Hide model answers" : "Show model answers"}
      </Link>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <p className="mt-1 text-[0.88rem] text-pencil">Tip: take the online test before looking at the answers.</p>
    </div>
  );
}
