"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { saveQuestionAction } from "@/app/admin/actions";
import type { QuestionType, SourceType, VerificationStatus } from "@/db/schema";
import { SOURCE_LABELS, STATUS_LABELS } from "@/lib/provenance";
import { TYPE_NAMES } from "../question-block";

export type FormCatalogSubject = { id: number; label: string; chapters: { id: number; name: string; topics: { id: number; name: string }[] }[] };
export type FormPaper = { id: number; subjectId: number; title: string; year: number | null; paperType: string; isDemo: boolean };

export type QuestionFormValues = {
  id?: number;
  subjectId?: number;
  chapterId?: number;
  topicId?: number | null;
  questionType: QuestionType;
  marks: number;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "UNRATED";
  questionText: string;
  options: string[];
  correctOption?: number;
  acceptedAnswers: string;
  numericValue: string;
  numericTolerance: string;
  numericUnit: string;
  answerText: string;
  explanation: string;
  sourceType: SourceType;
  verificationStatus: VerificationStatus;
  verificationNotes: string;
  isPublished: boolean;
};

const TYPES: QuestionType[] = ["MCQ", "ASSERTION_REASON", "FILL_BLANK", "NUMERICAL", "SHORT_ANSWER", "LONG_ANSWER", "CASE_BASED"];
const SOURCES: SourceType[] = ["VERIFIED_PYQ", "OFFICIAL_SAMPLE", "USER_CONTRIBUTED", "AI_SUPPLEMENTARY", "PENDING_REVIEW"];
const STATUSES: VerificationStatus[] = ["UNVERIFIED", "VERIFIED", "REJECTED"];

function Err({ msg, id }: { msg?: string; id: string }) {
  return msg ? (
    <p id={id} className="field-error">
      {msg}
    </p>
  ) : null;
}

export function QuestionForm({
  catalog,
  papers,
  initial,
  isDemo,
  hasSources,
}: {
  catalog: FormCatalogSubject[];
  papers: FormPaper[];
  initial: QuestionFormValues;
  isDemo: boolean;
  hasSources: boolean;
}) {
  const [state, action, pending] = useActionState(saveQuestionAction, undefined);
  const e = state?.errors ?? {};
  const [subjectId, setSubjectId] = useState<number | undefined>(initial.subjectId);
  const [chapterId, setChapterId] = useState<number | undefined>(initial.chapterId);
  const [type, setType] = useState<QuestionType>(initial.questionType);
  const [sourceType, setSourceType] = useState<SourceType>(initial.sourceType);
  const [status, setStatus] = useState<VerificationStatus>(initial.verificationStatus);
  const subject = catalog.find((s) => s.id === subjectId);
  const chapter = subject?.chapters.find((c) => c.id === chapterId);
  const subjectPapers = papers.filter((p) => p.subjectId === subjectId && (isDemo || !p.isDemo));
  const options = [...initial.options, "", "", "", ""].slice(0, 4);
  const inv = (k: string) => (e[k] ? { "aria-invalid": true, "aria-describedby": `err-${k}` } : {});

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(ev) => {
        // Submit manually so React doesn't reset the fields when validation fails.
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {e.form && (
        <p role="alert" className="rounded-md border-2 border-margin/60 bg-margin-soft px-4 py-3 font-bold">
          {e.form}
        </p>
      )}
      {Object.keys(e).length > 0 && !e.form && (
        <p role="alert" className="rounded-md border-2 border-margin/60 bg-margin-soft px-4 py-3 font-bold">
          The question wasn&apos;t saved. Fix the {Object.keys(e).length === 1 ? "field" : "fields"} marked below.
        </p>
      )}

      <fieldset className="panel grid gap-4 p-5 md:grid-cols-3">
        <legend className="px-1 font-bold">Where it belongs</legend>
        <div>
          <label htmlFor="subjectId" className="field-label">
            Board, class and subject
          </label>
          <select
            id="subjectId"
            name="subjectId"
            className="select"
            value={subjectId ?? ""}
            onChange={(ev) => {
              setSubjectId(Number(ev.target.value) || undefined);
              setChapterId(undefined);
            }}
            {...inv("subjectId")}
          >
            <option value="">Choose</option>
            {catalog.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <Err id="err-subjectId" msg={e.subjectId} />
        </div>
        <div>
          <label htmlFor="chapterId" className="field-label">
            Chapter
          </label>
          <select
            id="chapterId"
            name="chapterId"
            className="select"
            value={chapterId ?? ""}
            onChange={(ev) => setChapterId(Number(ev.target.value) || undefined)}
            disabled={!subject}
            {...inv("chapterId")}
          >
            <option value="">{subject ? "Choose" : "Choose a subject first"}</option>
            {subject?.chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Err id="err-chapterId" msg={e.chapterId} />
        </div>
        <div>
          <label htmlFor="topicId" className="field-label">
            Topic (optional)
          </label>
          <select id="topicId" name="topicId" className="select" defaultValue={initial.topicId ?? ""} key={chapterId} disabled={!chapter} {...inv("topicId")}>
            <option value="">None</option>
            {chapter?.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Err id="err-topicId" msg={e.topicId} />
        </div>
      </fieldset>

      <fieldset className="panel space-y-4 p-5">
        <legend className="px-1 font-bold">Question</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="questionType" className="field-label">
              Type
            </label>
            <select id="questionType" name="questionType" className="select" value={type} onChange={(ev) => setType(ev.target.value as QuestionType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_NAMES[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="marks" className="field-label">
              Marks
            </label>
            <input id="marks" name="marks" type="number" min={1} max={20} className="input num" defaultValue={initial.marks} {...inv("marks")} />
            <Err id="err-marks" msg={e.marks} />
          </div>
          <div>
            <label htmlFor="difficulty" className="field-label">
              Difficulty
            </label>
            <select id="difficulty" name="difficulty" className="select" defaultValue={initial.difficulty}>
              <option value="UNRATED">Not rated (board questions)</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="questionText" className="field-label">
            Question text
          </label>
          <textarea id="questionText" name="questionText" className="textarea font-serif" rows={5} defaultValue={initial.questionText} {...inv("questionText")} />
          <p className="field-hint mt-1">Write it exactly as printed on the source paper. Use ____ for a blank.</p>
          <Err id="err-questionText" msg={e.questionText} />
        </div>

        {(type === "MCQ" || type === "ASSERTION_REASON") && (
          <fieldset>
            <legend className="field-label">Options (select the correct one only if an official key exists)</legend>
            <label className="mb-2 flex items-center gap-2 text-[0.93rem]">
              <input type="radio" name="correctOption" value="" defaultChecked={initial.correctOption === undefined} className="size-5 accent-[var(--color-ink)]" />
              No answer key (students self-mark against the marking scheme)
            </label>
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correctOption"
                    value={i}
                    defaultChecked={initial.correctOption === i}
                    aria-label={`Option ${String.fromCharCode(97 + i)} is correct`}
                    className="size-5 accent-[var(--color-ink)]"
                  />
                  <span className="w-6 font-bold">({String.fromCharCode(97 + i)})</span>
                  <input name="options" className="input" defaultValue={o} aria-label={`Option ${String.fromCharCode(97 + i)}`} />
                </div>
              ))}
            </div>
            <Err id="err-options" msg={e.options ?? e.correctOption} />
          </fieldset>
        )}
        {type === "FILL_BLANK" && (
          <div>
            <label htmlFor="acceptedAnswers" className="field-label">
              Accepted answers
            </label>
            <textarea id="acceptedAnswers" name="acceptedAnswers" className="textarea" rows={3} defaultValue={initial.acceptedAnswers} {...inv("acceptedAnswers")} />
            <p className="field-hint mt-1">One per line or comma-separated. Matching ignores case and punctuation.</p>
            <Err id="err-acceptedAnswers" msg={e.acceptedAnswers} />
          </div>
        )}
        {type === "NUMERICAL" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="numericValue" className="field-label">
                Correct value
              </label>
              <input id="numericValue" name="numericValue" inputMode="decimal" className="input num" defaultValue={initial.numericValue} {...inv("numericValue")} />
              <Err id="err-numericValue" msg={e.numericValue} />
            </div>
            <div>
              <label htmlFor="numericTolerance" className="field-label">
                Allowed difference
              </label>
              <input id="numericTolerance" name="numericTolerance" inputMode="decimal" className="input num" defaultValue={initial.numericTolerance} />
            </div>
            <div>
              <label htmlFor="numericUnit" className="field-label">
                Unit
              </label>
              <input id="numericUnit" name="numericUnit" className="input" defaultValue={initial.numericUnit} />
            </div>
          </div>
        )}
        <div>
          <label htmlFor="answerText" className="field-label">
            Model answer
          </label>
          <textarea id="answerText" name="answerText" className="textarea font-serif" rows={4} defaultValue={initial.answerText} />
        </div>
        <div>
          <label htmlFor="explanation" className="field-label">
            Explanation (optional)
          </label>
          <textarea id="explanation" name="explanation" className="textarea" rows={2} defaultValue={initial.explanation} />
        </div>
      </fieldset>

      <fieldset className="panel space-y-4 p-5">
        <legend className="px-1 font-bold">Provenance</legend>
        {isDemo && <p className="demo-banner px-3 py-2 text-[0.93rem] font-bold">This is demo data. It is always shown with the DEMO DATA label, whatever its category.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="sourceType" className="field-label">
              Source category
            </label>
            <select id="sourceType" name="sourceType" className="select" value={sourceType} onChange={(ev) => setSourceType(ev.target.value as SourceType)}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s].long}
                </option>
              ))}
            </select>
            <p className="field-hint mt-1">{SOURCE_LABELS[sourceType].description}</p>
          </div>
          <div>
            <label htmlFor="verificationStatus" className="field-label">
              Verification status
            </label>
            <select
              id="verificationStatus"
              name="verificationStatus"
              className="select"
              value={status}
              onChange={(ev) => setStatus(ev.target.value as VerificationStatus)}
              {...inv("verificationStatus")}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <Err id="err-verificationStatus" msg={e.verificationStatus} />
          </div>
        </div>
        {sourceType === "VERIFIED_PYQ" && status === "VERIFIED" && !hasSources && (
          <p className="rounded-md border border-ink-line bg-ink-soft px-3 py-2 text-[0.93rem]">
            To verify a PYQ, link the board exam paper (with its year) below. It will be checked when you save.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <div>
            <label htmlFor="linkPaperId" className="field-label">
              {hasSources ? "Link another source paper (optional)" : "Source paper (optional)"}
            </label>
            <select id="linkPaperId" name="linkPaperId" className="select" defaultValue="" disabled={!subject} {...inv("linkPaperId")}>
              <option value="">{subject ? "None" : "Choose a subject first"}</option>
              {subjectPapers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.year ? ` (${p.year})` : ""}
                </option>
              ))}
            </select>
            <Err id="err-linkPaperId" msg={e.linkPaperId} />
            {subject && subjectPapers.length === 0 && (
              <p className="field-hint mt-1">
                No source papers for this subject yet.{" "}
                <Link href="/admin/papers" className="link">
                  Add one
                </Link>
                .
              </p>
            )}
          </div>
          <div>
            <label htmlFor="linkQuestionNumber" className="field-label">
              Question no.
            </label>
            <input id="linkQuestionNumber" name="linkQuestionNumber" className="input" placeholder="e.g. 4(b)" />
          </div>
        </div>
        <div>
          <label htmlFor="verificationNotes" className="field-label">
            Verification notes
          </label>
          <textarea id="verificationNotes" name="verificationNotes" className="textarea" rows={2} defaultValue={initial.verificationNotes} />
          <p className="field-hint mt-1">How and where it was checked. Visible to editors only.</p>
        </div>
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" name="isPublished" defaultChecked={initial.isPublished} className="size-5 accent-[var(--color-ink)]" />
          Published (can appear in papers and public pages once verified)
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : initial.id ? "Save changes" : "Add question"}
        </button>
        <Link href="/admin/questions" className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
