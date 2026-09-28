"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PaperMode, QuestionType } from "@/db/schema";
import type { YearCoverage } from "@/lib/engine/coverage";
import { MODE_LABELS, suggestedMinutes, type Composition, type GenerateFailure, type Stage } from "@/lib/engine/generator";
import type { CatalogBoard } from "@/lib/data/taxonomy";
import { CompositionBar } from "./composition";
import { SubjectGlyph } from "./subject-glyph";

type Initial = { subjectId?: number; chapterIds?: number[]; mode?: PaperMode };
type Difficulty = "MIXED" | "EASY" | "MEDIUM" | "HARD";
export type Availability = Record<number, { verified: number; pending: number; ai: number; years: number[] }>;

type EstimateResponse = {
  eligibleCount: number;
  eligibleMarks: number;
  byCategory: Composition;
  projected: Composition | null;
  failure: GenerateFailure | null;
  poolHasDemo: boolean;
  coverage: { verifiedPyqs: number; pendingPyqs: number; byYear: YearCoverage[] };
};

const MARK_PRESETS = [20, 25, 40, 50, 80];
const TIME_PRESETS = [30, 45, 60, 90, 120, 180];
const PYQ_MODES: PaperMode[] = ["PYQ_ONLY", "RECENT_PYQ", "MOST_REPEATED", "PYQ_PRIORITY", "EXAM_SIMULATION", "PYQ_PLUS_OFFICIAL"];
const PRACTICE_MODES: PaperMode[] = ["PRACTICE", "AI_SUPPLEMENTARY"];
const FILLABLE: PaperMode[] = ["PYQ_PRIORITY", "EXAM_SIMULATION"];
const TYPE_OPTIONS: [QuestionType, string][] = [
  ["MCQ", "Multiple choice"],
  ["ASSERTION_REASON", "Assertion–reason"],
  ["SHORT_ANSWER", "Short answer"],
  ["LONG_ANSWER", "Long answer"],
  ["CASE_BASED", "Case-based"],
  ["NUMERICAL", "Numerical"],
  ["FILL_BLANK", "Fill in the blank"],
];

function Tick() {
  return (
    <span className="pick-tick" aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 6.5 5 9l4.5-6" />
      </svg>
    </span>
  );
}

function findSubject(catalog: CatalogBoard[], subjectId?: number) {
  for (const b of catalog) for (const c of b.classes) for (const s of c.subjects) if (s.id === subjectId) return { b, c, s };
  return null;
}

type Progress = { phase: "idle" } | { phase: "working"; stages: Stage[]; shown: number; done: boolean; id?: string };

export function GeneratorForm({ catalog, initial, availability }: { catalog: CatalogBoard[]; initial: Initial; availability: Availability }) {
  const router = useRouter();
  const start = findSubject(catalog, initial.subjectId);
  const [boardId, setBoardId] = useState(start?.b.id ?? catalog[0]?.id);
  const board = catalog.find((b) => b.id === boardId) ?? catalog[0];
  const [classId, setClassId] = useState<number | undefined>(start?.c.id);
  const cls = board?.classes.find((c) => c.id === classId);
  const [subjectId, setSubjectId] = useState<number | undefined>(start?.s.id);
  const subject = cls?.subjects.find((s) => s.id === subjectId);
  const initialChapters = start ? (initial.chapterIds ?? []).filter((id) => start.s.chapters.some((c) => c.id === id)) : [];
  const [scope, setScope] = useState<"full" | "chapters">(initialChapters.length ? "chapters" : "full");
  const [chapterIds, setChapterIds] = useState<number[]>(initialChapters);
  const [marks, setMarks] = useState(40);
  const [minutes, setMinutes] = useState(60);
  const [minutesTouched, setMinutesTouched] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("MIXED");
  const [mode, setMode] = useState<PaperMode>(initial.mode ?? "PYQ_ONLY");
  const [allowSupplement, setAllowSupplement] = useState(false);
  const [types, setTypes] = useState<QuestionType[]>([]);
  const [yearFrom, setYearFrom] = useState<number | undefined>();
  const [yearTo, setYearTo] = useState<number | undefined>();
  const [excludeFigures, setExcludeFigures] = useState(false);

  const [estState, setEstState] = useState<{ key: string; data?: EstimateResponse; error?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<{ key: string; error?: string; failure?: GenerateFailure } | null>(null);
  const [progress, setProgress] = useState<Progress>({ phase: "idle" });
  const dialogRef = useRef<HTMLDialogElement>(null);

  const marksValid = Number.isInteger(marks) && marks >= 5 && marks <= 100;
  const minutesValid = Number.isInteger(minutes) && minutes >= 5 && minutes <= 240;
  const effectiveChapters = scope === "chapters" ? chapterIds : [];
  const ready = Boolean(subject) && marksValid && minutesValid && (scope === "full" || chapterIds.length > 0);

  const payload = subject
    ? {
        subjectId: subject.id,
        chapterIds: effectiveChapters,
        totalMarks: marks,
        durationMinutes: minutes,
        difficulty,
        mode,
        allowSupplement: FILLABLE.includes(mode) && allowSupplement,
        questionTypes: types,
        yearFrom,
        yearTo,
        excludeFigures,
      }
    : null;
  const payloadKey = payload && marksValid && minutesValid ? JSON.stringify(payload) : "";

  const est = payloadKey ? (estState?.data ?? null) : null;
  const estError = estState?.key === payloadKey ? (estState.error ?? null) : null;
  const estLoading = Boolean(payloadKey) && estState?.key !== payloadKey;
  const submitError = submitState && (submitState.key === payloadKey || !payloadKey) ? (submitState.error ?? null) : null;
  const failure = submitState?.key === payloadKey ? (submitState.failure ?? null) : null;

  function changeMarks(m: number) {
    setMarks(m);
    if (!minutesTouched && Number.isInteger(m) && m >= 5 && m <= 100) setMinutes(suggestedMinutes(m));
  }

  useEffect(() => {
    if (!payloadKey) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: payloadKey });
        const data = (await res.json()) as EstimateResponse & { error?: string };
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Couldn't check the question bank.");
        setEstState({ key: payloadKey, data });
      } catch (e) {
        if (!cancelled) setEstState((prev) => ({ key: payloadKey, data: prev?.data, error: e instanceof Error ? e.message : "Couldn't check the question bank." }));
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [payloadKey]);

  // Reveal the engine's real stages one by one, then open the paper.
  useEffect(() => {
    if (progress.phase !== "working" || !progress.done) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (progress.shown < progress.stages.length) {
      const t = setTimeout(() => setProgress({ ...progress, shown: progress.shown + 1 }), reduce ? 0 : 420);
      return () => clearTimeout(t);
    }
    if (progress.id) {
      const t = setTimeout(() => router.push(`/paper/${progress.id}`), reduce ? 0 : 500);
      return () => clearTimeout(t);
    }
  }, [progress, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!ready) {
      const target = !cls ? 'input[name="class"]' : !subject ? 'input[name="subject"]' : scope === "chapters" && !chapterIds.length ? 'input[name="chapter"]' : !marksValid ? "#marks" : "#minutes";
      document.querySelector<HTMLElement>(target)?.focus();
      setSubmitState({
        key: payloadKey,
        error: !cls
          ? "Choose a class first."
          : !subject
            ? "Choose a subject first."
            : scope === "chapters" && !chapterIds.length
              ? "Tick at least one chapter, or switch to the full syllabus."
              : "Fix the marks or time above to continue.",
      });
      return;
    }
    if (!payload) return;
    setSubmitting(true);
    setSubmitState(null);
    setProgress({ phase: "working", stages: [], shown: 0, done: false });
    dialogRef.current?.showModal();
    try {
      const res = await fetch("/api/papers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = (await res.json()) as { id?: string; stages?: Stage[]; failure?: GenerateFailure; error?: string };
      if (res.status === 201 && data.id) {
        setProgress({ phase: "working", stages: data.stages ?? [], shown: 0, done: true, id: data.id });
        return;
      }
      dialogRef.current?.close();
      setProgress({ phase: "idle" });
      setSubmitState(data.failure ? { key: payloadKey, failure: data.failure } : { key: payloadKey, error: data.error ?? "The paper couldn't be built. Try again." });
    } catch {
      dialogRef.current?.close();
      setProgress({ phase: "idle" });
      setSubmitState({ key: payloadKey, error: "The paper couldn't be built because the connection failed. Check your internet and try again." });
    }
    setSubmitting(false);
  }

  function toggleChapter(id: number) {
    setChapterIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const shownFailure = failure ?? (estLoading ? null : (est?.failure ?? null));
  const projectedTotal = est?.projected ? Object.values(est.projected).reduce((s, v) => s + v.marks, 0) : 0;
  const pyqShare = est?.projected && projectedTotal ? Math.round((est.projected.VERIFIED_PYQ.marks / projectedTotal) * 100) : null;
  const avail = subject ? availability[subject.id] : undefined;

  const modeTile = (m: PaperMode) => (
    <label key={m} className="choice h-full">
      <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
      <span>
        <span className="block font-bold">{MODE_LABELS[m].name}</span>
        <span className="block text-[0.9rem] text-pencil">{MODE_LABELS[m].description}</span>
      </span>
    </label>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-8 lg:grid-cols-[1fr_23rem] lg:items-start xl:grid-cols-[1fr_25rem]">
      <div className="space-y-5">
        <Step n={1} title="Board and class">
          <div className="grid gap-4">
            <div role="radiogroup" aria-label="Board" className="inline-flex w-fit rounded-full border border-rule bg-desk p-1">
              {catalog.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={boardId === b.id}
                  onClick={() => {
                    setBoardId(b.id);
                    setClassId(undefined);
                    setSubjectId(undefined);
                    setChapterIds([]);
                  }}
                  className={`min-h-10 rounded-full px-5 font-bold transition-colors ${boardId === b.id ? "bg-night text-white" : "text-pencil hover:text-graphite"}`}
                >
                  {b.name}
                </button>
              ))}
            </div>
            <fieldset>
              <legend className="field-label">Class</legend>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {[...(board?.classes ?? [])].map((c) => (
                  <label key={c.id} className="choice justify-center px-2">
                    <input
                      type="radio"
                      name="class"
                      className="sr-only"
                      checked={classId === c.id}
                      onChange={() => {
                        setClassId(c.id);
                        setSubjectId(undefined);
                        setChapterIds([]);
                      }}
                    />
                    <span key={classId === c.id ? "on" : "off"} className={`font-serif text-[1.08rem] font-semibold ${classId === c.id ? "numeral-roll" : ""}`}>
                      {c.level}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </Step>

        <Step n={2} title="Subject" muted={!cls}>
          {!cls ? (
            <p className="text-pencil">Choose a class first.</p>
          ) : (
            <fieldset>
              <legend className="sr-only">Subject</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {cls.subjects.map((s) => {
                  const a = availability[s.id];
                  return (
                    <label key={s.id} className="choice glyph-host items-center">
                      <input
                        type="radio"
                        name="subject"
                        checked={subjectId === s.id}
                        onChange={() => {
                          setSubjectId(s.id);
                          setChapterIds([]);
                        }}
                      />
                      <span className="text-ink">
                        <SubjectGlyph slug={s.slug} size={30} />
                      </span>
                      <span>
                        <span className="block font-bold">{s.name}</span>
                        <span className="block text-[0.85rem] text-pencil">
                          {a?.verified ? `${a.verified} verified PYQs` : a?.pending ? `${a.pending} PYQs awaiting review` : "No verified PYQs yet"}
                          {a?.ai ? `, ${a.ai} AI practice` : ""}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        </Step>

        <Step n={3} title="Scope" muted={!subject}>
          {!subject ? (
            <p className="text-pencil">Choose a subject first.</p>
          ) : (
            <fieldset>
              <legend className="sr-only">Scope</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className="choice">
                  <input type="radio" name="scope" checked={scope === "full"} onChange={() => setScope("full")} />
                  <span>
                    <span className="block font-bold">Full syllabus</span>
                    <span className="block text-[0.85rem] text-pencil">All {subject.chapters.length} chapters</span>
                  </span>
                </label>
                <label className="choice">
                  <input type="radio" name="scope" checked={scope === "chapters"} onChange={() => setScope("chapters")} disabled={!subject.chapters.length} />
                  <span>
                    <span className="block font-bold">Chapter-wise</span>
                    <span className="block text-[0.85rem] text-pencil">{subject.chapters.length ? "Pick the chapters" : "No chapter list yet"}</span>
                  </span>
                </label>
              </div>
              {scope === "chapters" && (
                <div className="expand-in mt-4">
                  <p className="mb-2 text-[0.95rem] font-bold" aria-live="polite">
                    {chapterIds.length} of {subject.chapters.length} chapters
                    {chapterIds.length > 0 && (
                      <button type="button" className="link ml-3 font-bold" onClick={() => setChapterIds([])}>
                        Clear
                      </button>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {subject.chapters.map((c) => (
                      <label key={c.id} className="pick" data-fx="ripple">
                        <input type="checkbox" name="chapter" checked={chapterIds.includes(c.id)} onChange={() => toggleChapter(c.id)} />
                        <Tick />
                        <span>{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </fieldset>
          )}
        </Step>

        <Step n={4} title="Marks, time and difficulty">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="marks" className="field-label">
                Total marks
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Common totals">
                {MARK_PRESETS.map((m) => (
                  <button key={m} type="button" aria-pressed={marks === m} onClick={() => changeMarks(m)} className={`btn btn-sm num ${marks === m ? "btn-primary" : "btn-secondary"}`}>
                    {m}
                  </button>
                ))}
              </div>
              <input
                id="marks"
                type="number"
                inputMode="numeric"
                min={5}
                max={100}
                className="input num mt-2 max-w-[9rem]"
                value={Number.isNaN(marks) ? "" : marks}
                aria-invalid={!marksValid}
                aria-describedby="marks-hint"
                onChange={(e) => changeMarks(e.target.value === "" ? NaN : Math.round(Number(e.target.value)))}
              />
              <p id="marks-hint" className={marksValid ? "field-hint mt-1" : "field-error"}>
                {marksValid ? "Between 5 and 100." : "Enter a whole number of marks between 5 and 100."}
              </p>
            </div>
            <div>
              <label htmlFor="minutes" className="field-label">
                Time limit (minutes)
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Common time limits">
                {TIME_PRESETS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={minutes === m}
                    onClick={() => {
                      setMinutes(m);
                      setMinutesTouched(true);
                    }}
                    className={`btn btn-sm num ${minutes === m ? "btn-primary" : "btn-secondary"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <input
                id="minutes"
                type="number"
                inputMode="numeric"
                min={5}
                max={240}
                className="input num mt-2 max-w-[9rem]"
                value={Number.isNaN(minutes) ? "" : minutes}
                aria-invalid={!minutesValid}
                aria-describedby="minutes-hint"
                onChange={(e) => {
                  setMinutesTouched(true);
                  setMinutes(e.target.value === "" ? NaN : Math.round(Number(e.target.value)));
                }}
              />
              <p id="minutes-hint" className={minutesValid ? "field-hint mt-1" : "field-error"}>
                {minutesValid ? (marksValid ? `About 1.5 minutes a mark is a fair pace: ${suggestedMinutes(marks)} minutes for ${marks} marks.` : "Between 5 and 240 minutes.") : "Enter a time between 5 and 240 minutes."}
              </p>
            </div>
          </div>
          <fieldset className="mt-6">
            <legend className="field-label">Difficulty</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["MIXED", "EASY", "MEDIUM", "HARD"] as Difficulty[]).map((d) => (
                <label key={d} className="choice">
                  <input type="radio" name="difficulty" checked={difficulty === d} onChange={() => setDifficulty(d)} />
                  <span className="font-bold">{d === "MIXED" ? "Mixed" : d[0] + d.slice(1).toLowerCase()}</span>
                </label>
              ))}
            </div>
            <p className="field-hint mt-1">Board exam questions aren&apos;t rated for difficulty, so this only affects practice questions.</p>
          </fieldset>
        </Step>

        <Step n={5} title="Mode">
          <fieldset>
            <legend className="field-label">Previous-year question modes</legend>
            <div className="grid gap-2 sm:grid-cols-2">{PYQ_MODES.map(modeTile)}</div>
          </fieldset>
          <fieldset className="mt-5">
            <legend className="field-label">Practice modes (labelled, not PYQs)</legend>
            <div className="grid gap-2 sm:grid-cols-2">{PRACTICE_MODES.map(modeTile)}</div>
          </fieldset>
          {FILLABLE.includes(mode) && (
            <label className="expand-in mt-4 flex items-start gap-3 rounded-xl border border-ink-line bg-ink-soft/60 p-3">
              <input type="checkbox" className="mt-1 size-5 accent-[var(--color-ink)]" checked={allowSupplement} onChange={(e) => setAllowSupplement(e.target.checked)} />
              <span>
                <span className="block font-bold">Allow labelled practice questions to fill gaps</span>
                <span className="block text-[0.9rem] text-pencil">
                  If there aren&apos;t enough verified PYQs, official samples, community and AI practice questions may be added. Each keeps its own stamp.
                </span>
              </span>
            </label>
          )}
        </Step>

        <Step n={6} title="Refine (optional)" muted={!subject}>
          <fieldset>
            <legend className="field-label">Question types</legend>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map(([t, label]) => (
                <label key={t} className="pick" data-fx="ripple">
                  <input type="checkbox" name="qtype" checked={types.includes(t)} onChange={() => setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))} />
                  <Tick />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <p className="field-hint mt-1">{types.length ? `Only ${types.length} type${types.length === 1 ? "" : "s"}.` : "All types. Tick some to narrow the paper."}</p>
          </fieldset>
          <fieldset className="mt-5">
            <legend className="field-label">Exam years for PYQs</legend>
            {avail && avail.years.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="year-from">
                  From year
                </label>
                <select id="year-from" className="select max-w-[9rem]" value={yearFrom ?? ""} onChange={(e) => setYearFrom(e.target.value ? Number(e.target.value) : undefined)}>
                  <option value="">Earliest</option>
                  {[...avail.years].sort((a, b) => a - b).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <span className="text-pencil">to</span>
                <label className="sr-only" htmlFor="year-to">
                  To year
                </label>
                <select id="year-to" className="select max-w-[9rem]" value={yearTo ?? ""} onChange={(e) => setYearTo(e.target.value ? Number(e.target.value) : undefined)}>
                  <option value="">Latest</option>
                  {[...avail.years].sort((a, b) => b - a).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-[0.95rem] text-pencil">No verified exam years for this subject yet, so there&apos;s nothing to narrow.</p>
            )}
          </fieldset>
          <label className="mt-5 flex items-start gap-3">
            <input type="checkbox" className="mt-1 size-5 accent-[var(--color-ink)]" checked={excludeFigures} onChange={(e) => setExcludeFigures(e.target.checked)} />
            <span>
              <span className="block font-bold">Leave out questions that need a figure</span>
              <span className="block text-[0.9rem] text-pencil">Figures and tables from source papers aren&apos;t reproduced, so these questions link to the source page instead.</span>
            </span>
          </label>
          <p className="mt-4 text-[0.9rem] text-pencil">The same question from several paper sets is always used once.</p>
        </Step>
      </div>

      <aside className="lg:sticky lg:top-24" aria-labelledby="summary-title">
        <div className="sheet overflow-hidden">
          <div className="bg-night px-5 py-4 text-white">
            <h2 id="summary-title" className="text-[1.3rem] text-white">
              Your paper
            </h2>
            <p className="text-[0.9rem] text-white/70">{subject ? `${board?.name} ${cls?.name} ${subject.name}` : "Choose a class and subject"}</p>
          </div>
          <div className="p-5">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.95rem]">
              <dt className="text-pencil">Scope</dt>
              <dd>{subject ? (scope === "full" ? "Full syllabus" : `${chapterIds.length} chapter${chapterIds.length === 1 ? "" : "s"}`) : "–"}</dd>
              <dt className="text-pencil">Marks and time</dt>
              <dd className="num">{marksValid && minutesValid ? `${marks} marks, ${minutes} min` : "–"}</dd>
              <dt className="text-pencil">Mode</dt>
              <dd>{MODE_LABELS[mode].name}</dd>
            </dl>
            {subject && scope === "chapters" && chapterIds.length > 0 && (
              <ol className="chapter-chain mt-3" aria-label="Chapters in this paper">
                {subject.chapters
                  .filter((c) => chapterIds.includes(c.id))
                  .map((c) => (
                    <li key={c.id} className="expand-in">
                      {c.name}
                    </li>
                  ))}
              </ol>
            )}

            <div className="mt-5 border-t border-rule pt-5" aria-live="polite" aria-busy={estLoading}>
              {!subject ? (
                <p className="text-[0.95rem] text-pencil">Pick a subject to see what&apos;s available.</p>
              ) : estError ? (
                <p className="field-error">{estError}</p>
              ) : !est ? (
                <p className="text-[0.95rem] text-pencil">Checking the question bank…</p>
              ) : (
                <div className={estLoading ? "opacity-60 transition-opacity" : "transition-opacity"}>
                  <p className="text-sm font-bold text-pencil">Verified PYQs in this scope</p>
                  <p className="font-serif text-[2rem] font-semibold leading-tight num">{est.coverage.verifiedPyqs}</p>
                  {est.coverage.byYear.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-[0.92rem]">
                      {est.coverage.byYear.map((y) => (
                        <li key={y.year} className="flex justify-between gap-3">
                          <span className="font-bold num">{y.year}</span>
                          <span className="text-pencil">
                            {y.verified} verified{y.pending ? `, ${y.pending} awaiting review` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[0.92rem] text-pencil">Verified PYQs are not yet available for this selection.</p>
                  )}
                  {est.coverage.pendingPyqs > 0 && est.coverage.verifiedPyqs === 0 && (
                    <p className="mt-2 rounded-lg bg-pending-soft px-3 py-2 text-[0.88rem] text-pending">
                      {est.coverage.pendingPyqs} questions from official papers are extracted and waiting for an editor to verify them. They can&apos;t be used until then.
                    </p>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-rule pt-4">
                    <p>
                      <span className="block text-[0.82rem] text-pencil">Usable in this mode</span>
                      <span className="num font-serif text-[1.4rem] font-semibold">{est.eligibleCount}</span>
                      <span className="block text-[0.82rem] text-pencil">{est.eligibleMarks} marks</span>
                    </p>
                    <p>
                      <span className="block text-[0.82rem] text-pencil">Expected PYQ share</span>
                      <span className="num font-serif text-[1.4rem] font-semibold">{pyqShare === null ? "–" : `${pyqShare}%`}</span>
                      <span className="block text-[0.82rem] text-pencil">of marks</span>
                    </p>
                  </div>
                  {est.projected && (
                    <div className="mt-4">
                      <CompositionBar composition={est.projected} demo={est.poolHasDemo} caption="Expected make-up" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {shownFailure && subject && (
              <div role="alert" className="expand-in mt-5 rounded-xl border-2 border-margin/50 bg-margin-soft p-4">
                <p className="font-bold">{shownFailure.reason === "NO_QUESTIONS" ? "No questions available" : shownFailure.reason === "NO_REPEATS" ? "No repeated questions yet" : "Not enough questions"}</p>
                <p className="mt-1 text-[0.95rem]">{shownFailure.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {shownFailure.maxAchievableMarks >= 5 && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => changeMarks(shownFailure.maxAchievableMarks)}>
                      Make it {shownFailure.maxAchievableMarks} marks
                    </button>
                  )}
                  {FILLABLE.includes(mode) && !allowSupplement && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAllowSupplement(true)}>
                      Allow practice questions
                    </button>
                  )}
                  {mode !== "PRACTICE" && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode("PRACTICE")}>
                      Switch to practice mix
                    </button>
                  )}
                  {mode === "MOST_REPEATED" && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode("RECENT_PYQ")}>
                      Try recent PYQs
                    </button>
                  )}
                  {scope === "chapters" && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setScope("full")}>
                      Use the full syllabus
                    </button>
                  )}
                </div>
              </div>
            )}

            {submitError && (
              <p role="alert" className="field-error mt-4">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary fx-sweep mt-5 w-full text-[1.05rem]"
              disabled={submitting || Boolean(subject && est?.failure && !estLoading)}
              data-magnetic
              data-fx="pulse"
            >
              {submitting ? "Building your paper…" : "Build paper"}
            </button>
            {avail && avail.verified === 0 && avail.ai > 0 && (
              <p className="mt-3 text-center text-[0.85rem] text-pencil">Only AI practice questions are published for this subject so far.</p>
            )}
          </div>
        </div>
      </aside>

      <dialog ref={dialogRef} className="modal" aria-labelledby="gen-title" onCancel={(e) => e.preventDefault()}>
        <div className="bg-night p-6 text-white">
          <h2 id="gen-title" className="text-[1.4rem] text-white">
            {progress.phase === "working" && progress.done ? "Paper ready" : "Building your paper"}
          </h2>
          <p className="mt-1 text-[0.9rem] text-white/70">These are the steps the builder actually ran for your paper.</p>
          <ol className="mt-5 space-y-3" aria-live="polite">
            {progress.phase === "working" && !progress.done && (
              <li className="flex items-center gap-3">
                <span className="live-dot text-[#6fe3ff]" aria-hidden="true" />
                <span>Working…</span>
              </li>
            )}
            {progress.phase === "working" &&
              progress.stages.slice(0, progress.shown).map((s, i) => (
                <li key={s.key} className="expand-in flex items-start gap-3" style={{ ["--d" as string]: `${i * 20}ms` }}>
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#3ddc97]/20 text-[#8ff0c4]" aria-hidden="true">
                    ✓
                  </span>
                  <span>
                    <strong className="block">{s.label}</strong>
                    <span className="text-[0.9rem] text-white/70">{s.detail}</span>
                  </span>
                </li>
              ))}
          </ol>
        </div>
      </dialog>
    </form>
  );
}

function Step({ n, title, hint, muted, children }: { n: number; title: string; hint?: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <section className={`panel rounded-2xl p-5 sm:p-6 ${muted ? "opacity-75" : ""}`} aria-labelledby={`step-${n}`}>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-full bg-night font-serif text-[1rem] font-semibold text-white" aria-hidden="true">
          {n}
        </span>
        <div>
          <h2 id={`step-${n}`} className="font-sans text-[1.1rem] font-bold">
            {title}
          </h2>
          {hint && <p className="field-hint">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
