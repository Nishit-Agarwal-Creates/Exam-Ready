"use client";

import { useActionState, useState } from "react";
import { answerWorkAction } from "@/app/admin/actions";
import type { AnswerDraft, AnswerSourceRef } from "@/db/schema";

function Err({ msg, id }: { msg?: string; id: string }) {
  return msg ? (
    <p id={id} className="field-error">
      {msg}
    </p>
  ) : null;
}

const LETTERS = ["a", "b", "c", "d", "e", "f"];

/**
 * Editor form for a question's answer. "Save draft" stores a draft students never see; "Publish" makes it the
 * answer: as an editor-reviewed model answer, or as the official answer only when a checked source is named.
 * Prefilled from the draft when there is one, otherwise from the published answer.
 */
export function AnswerForm({
  id,
  type,
  options,
  initial,
  hasDraft,
  draftOrigin,
}: {
  id: number;
  type: string;
  options: string[] | null;
  initial: AnswerDraft;
  hasDraft: boolean;
  draftOrigin: "AI" | "EDITOR" | null;
}) {
  const [state, action, pending] = useActionState(answerWorkAction, undefined);
  const [asOfficial, setAsOfficial] = useState(false);
  const e = state?.errors ?? {};
  const key = initial.key ?? null;
  const src: AnswerSourceRef = initial.source ?? {};
  const isOption = type === "MCQ" || type === "ASSERTION_REASON";
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="type" value={type} />
      {draftOrigin === "AI" && (
        <p className="rounded-lg border-2 border-pending/50 bg-pending-soft px-4 py-3 text-[0.95rem]">
          <strong>AI-generated draft, not reviewed.</strong> Check every step against the question (and its figure) before publishing. Publishing makes it your
          reviewed answer; it is never labelled official unless you name and check an official source.
        </p>
      )}
      {e.form && <p className="field-error">{e.form}</p>}

      {isOption && (
        <fieldset>
          <legend className="field-label">Correct option</legend>
          <label className="mb-2 flex items-center gap-2 text-[0.93rem]">
            <input type="radio" name="correctOption" value="" defaultChecked={!key || !("correctOption" in key)} className="size-5" />
            No answer key
          </label>
          {(options ?? []).map((o, i) => (
            <label key={i} className="flex items-center gap-2 py-0.5">
              <input type="radio" name="correctOption" value={i} defaultChecked={Boolean(key && "correctOption" in key && key.correctOption === i)} className="size-5" />
              <span className="font-bold">({LETTERS[i]})</span> <span>{o}</span>
            </label>
          ))}
          <Err id="err-key" msg={e.key} />
        </fieldset>
      )}
      {type === "FILL_BLANK" && (
        <div>
          <label htmlFor="accepted" className="field-label">
            Accepted answers
          </label>
          <textarea id="accepted" name="accepted" rows={3} className="textarea" defaultValue={key && "accepted" in key ? key.accepted.join("\n") : ""} />
          <p className="field-hint mt-1">One per line. Add genuine alternatives only (spelling variants, synonyms the question allows).</p>
          <Err id="err-key" msg={e.key} />
        </div>
      )}
      {type === "NUMERICAL" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="numValue" className="field-label">
              Correct value
            </label>
            <input id="numValue" name="numValue" inputMode="decimal" className="input num" defaultValue={key && "value" in key ? String(key.value) : ""} />
          </div>
          <div>
            <label htmlFor="numTolerance" className="field-label">
              Allowed difference
            </label>
            <input id="numTolerance" name="numTolerance" inputMode="decimal" className="input num" defaultValue={key && "value" in key ? String(key.tolerance ?? 0) : "0"} />
          </div>
          <div>
            <label htmlFor="numUnit" className="field-label">
              Unit
            </label>
            <input id="numUnit" name="numUnit" className="input" defaultValue={key && "value" in key ? (key.unit ?? "") : ""} />
          </div>
          <div className="sm:col-span-3">
            <Err id="err-key" msg={e.key} />
          </div>
        </div>
      )}

      <div>
        <label htmlFor="answerText" className="field-label">
          Model answer
        </label>
        <textarea id="answerText" name="answerText" rows={8} className="textarea font-serif" defaultValue={initial.text} aria-describedby="h-answer" />
        <p id="h-answer" className="field-hint mt-1">
          Original wording, with the steps a student needs. Don&apos;t paste copyrighted solutions; cite the source below if you used one.
        </p>
        <Err id="err-text" msg={e.text} />
      </div>
      <div>
        <label htmlFor="rubric" className="field-label">
          Marking points (rubric)
        </label>
        <textarea id="rubric" name="rubric" rows={4} className="textarea" defaultValue={initial.rubric ?? ""} />
        <p className="field-hint mt-1">For written answers: the points a marker looks for, one per line.</p>
        <Err id="err-rubric" msg={e.rubric} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="practiceMarks" className="field-label">
            Suggested practice marks (optional)
          </label>
          <input id="practiceMarks" name="practiceMarks" inputMode="numeric" className="input num max-w-[9rem]" defaultValue={initial.practiceMarks ?? ""} />
          <p className="field-hint mt-1">Shown as a suggestion, never as a printed mark, and never used in scored tests.</p>
          <Err id="err-pm" msg={e.practiceMarks} />
        </div>
        <div>
          <label htmlFor="notes" className="field-label">
            Notes for reviewers
          </label>
          <textarea id="notes" name="notes" rows={3} className="textarea" defaultValue={initial.notes ?? ""} />
          <Err id="err-notes" msg={e.notes} />
        </div>
      </div>

      <fieldset className="rounded-xl border border-rule p-4">
        <legend className="field-label px-1">Source of the answer (optional)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="srcTitle" className="field-label">
              Title
            </label>
            <input id="srcTitle" name="srcTitle" className="input" defaultValue={src.title ?? ""} placeholder="e.g. CISCE ICSE 2025 Physics specimen marking scheme" />
          </div>
          <div>
            <label htmlFor="srcYear" className="field-label">
              Year
            </label>
            <input id="srcYear" name="srcYear" inputMode="numeric" className="input num" defaultValue={src.year ?? ""} />
          </div>
          <div>
            <label htmlFor="srcQno" className="field-label">
              Question number
            </label>
            <input id="srcQno" name="srcQno" className="input" defaultValue={src.questionNumber ?? ""} />
          </div>
          <div>
            <label htmlFor="srcPage" className="field-label">
              Page
            </label>
            <input id="srcPage" name="srcPage" className="input" defaultValue={src.page ?? ""} />
          </div>
          <div>
            <label htmlFor="srcUrl" className="field-label">
              Link (https)
            </label>
            <input id="srcUrl" name="srcUrl" className="input" defaultValue={src.url ?? ""} />
          </div>
        </div>
        <Err id="err-source" msg={e.source} />
        <label className="mt-3 flex items-start gap-3">
          <input type="checkbox" name="asOfficial" className="mt-1 size-5" checked={asOfficial} onChange={(ev) => setAsOfficial(ev.target.checked)} />
          <span>
            <span className="block font-bold">This is the board&apos;s official answer</span>
            <span className="block text-[0.9rem] text-pencil">Only for an answer copied from an official answer key or marking scheme named above.</span>
          </span>
        </label>
        <label className="mt-2 flex items-start gap-3">
          <input type="checkbox" name="sourceChecked" className="mt-1 size-5" />
          <span>
            <span className="block font-bold">I checked this answer against the source above</span>
            <span className="block text-[0.9rem] text-pencil">Required for an official answer.</span>
          </span>
        </label>
        <Err id="err-checked" msg={e.sourceChecked} />
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button type="submit" name="intent" value="save" className="btn btn-secondary" disabled={pending}>
          Save draft
        </button>
        <button type="submit" name="intent" value="publish" className="btn btn-primary" disabled={pending}>
          {asOfficial ? "Publish as official answer" : "Publish as reviewed model answer"}
        </button>
        {hasDraft && (
          <button type="submit" name="intent" value="discard" className="btn btn-ghost" disabled={pending}>
            Discard draft
          </button>
        )}
      </div>
    </form>
  );
}
