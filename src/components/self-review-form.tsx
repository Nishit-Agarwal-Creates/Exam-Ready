"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { rememberAttempt } from "@/lib/history";

/**
 * Collects the self-marking selects rendered next to each written answer (they join this form
 * through the HTML `form` attribute) and saves them in one request.
 */
export function SelfReviewForm({ attemptId, pending, total }: { attemptId: string; pending: number; total: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => rememberAttempt(attemptId), [attemptId]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const marks: { questionId: number; marks: number }[] = [];
    for (const [k, v] of data.entries()) {
      if (k.startsWith("self-") && v !== "") marks.push({ questionId: Number(k.slice(5)), marks: Number(v) });
    }
    setStatus("saving");
    try {
      const res = await fetch(`/api/attempts/${attemptId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marks }),
      });
      if (!res.ok) throw new Error();
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  // Nothing to mark when no written answers were given.
  if (total === 0) return null;
  return (
    <form id="self-review" onSubmit={onSubmit} className="sheet flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-sans text-[1.05rem] font-bold">Mark your written answers</h2>
        <p className="text-[0.95rem] text-pencil">
          {pending > 0
            ? `${pending} of ${total} written answers still need your marks. Compare each with the model answer below, choose the marks, then save.`
            : "All written answers are marked. You can change your marks and save again."}
        </p>
      </div>
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save my marks"}
        </button>
        <p aria-live="polite" className={`text-sm ${status === "error" ? "field-error" : "text-pencil"}`}>
          {status === "saved" ? "Marks saved." : status === "error" ? "Couldn't save. Try again." : ""}
        </p>
      </div>
    </form>
  );
}
