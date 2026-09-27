"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PaperMode } from "@/db/schema";
import { MODE_LABELS, suggestedMinutes, type Composition, type GenerateFailure } from "@/lib/engine/generator";
import type { CatalogBoard } from "@/lib/data/taxonomy";
import { CompositionBar } from "./composition";

type Initial = { subjectId?: number; chapterIds?: number[]; mode?: PaperMode };
type Difficulty = "MIXED" | "EASY" | "MEDIUM" | "HARD";

type EstimateResponse = {
  eligibleCount: number;
  eligibleMarks: number;
  byTier: Composition;
  projected: Composition | null;
  failure: GenerateFailure | null;
  poolHasDemo: boolean;
};

const MARK_PRESETS = [20, 25, 40, 50, 80];
const TIME_PRESETS = [30, 45, 60, 90, 120, 150];
const MODES: PaperMode[] = ["PYQ_PRIORITY", "PYQ_ONLY", "EXAM_SIMULATION"];

function findSubject(catalog: CatalogBoard[], subjectId?: number) {
  for (const b of catalog) for (const c of b.classes) for (const s of c.subjects) if (s.id === subjectId) return { b, c, s };
  return null;
}

export function GeneratorForm({ catalog, initial }: { catalog: CatalogBoard[]; initial: Initial }) {
  const router = useRouter();
  const start = findSubject(catalog, initial.subjectId);
  const [boardId, setBoardId] = useState(start?.b.id ?? catalog[0]?.id);
  const board = catalog.find((b) => b.id === boardId) ?? catalog[0];
  const [classId, setClassId] = useState<number | undefined>(start?.c.id);
  const cls = board?.classes.find((c) => c.id === classId);
  const [subjectId, setSubjectId] = useState<number | undefined>(start?.s.id);
  const subject = cls?.subjects.find((s) => s.id === subjectId);
  const [chapterIds, setChapterIds] = useState<number[]>(start ? (initial.chapterIds ?? []).filter((id) => start.s.chapters.some((c) => c.id === id)) : []);
  const [marks, setMarks] = useState(40);
  const [minutes, setMinutes] = useState(60);
  const [minutesTouched, setMinutesTouched] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("MIXED");
  const [mode, setMode] = useState<PaperMode>(initial.mode ?? "PYQ_PRIORITY");

  // Results are stored with the request they belong to, so changing any input
  // invalidates them without resetting state inside an effect.
  const [estState, setEstState] = useState<{ key: string; data?: EstimateResponse; error?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<{ key: string; error?: string; failure?: GenerateFailure } | null>(null);

  const marksValid = Number.isInteger(marks) && marks >= 5 && marks <= 100;
  const minutesValid = Number.isInteger(minutes) && minutes >= 5 && minutes <= 240;
  const ready = Boolean(subject) && marksValid && minutesValid;

  const payload = subject ? { subjectId: subject.id, chapterIds, totalMarks: marks, durationMinutes: minutes, difficulty, mode } : null;
  const payloadKey = payload && marksValid && minutesValid ? JSON.stringify(payload) : "";

  const est = payloadKey ? (estState?.data ?? null) : null;
  const estError = estState?.key === payloadKey ? (estState.error ?? null) : null;
  const estLoading = Boolean(payloadKey) && estState?.key !== payloadKey;
  const submitError = submitState && (submitState.key === payloadKey || !payloadKey) ? (submitState.error ?? null) : null;
  const failure = submitState?.key === payloadKey ? (submitState.failure ?? null) : null;

  function changeMarks(m: number) {
    setMarks(m);
    // Keep the suggested time in step with marks until the student sets a time themselves.
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
        if (!cancelled)
          setEstState((prev) => ({ key: payloadKey, data: prev?.data, error: e instanceof Error ? e.message : "Couldn't check the question bank." }));
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [payloadKey]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!ready) {
      // Point the student at the first thing that needs fixing.
      const target = !cls ? 'input[name="class"]' : !subject ? 'input[name="subject"]' : !marksValid ? "#marks" : "#minutes";
      document.querySelector<HTMLElement>(target)?.focus();
      setSubmitState({ key: payloadKey, error: !cls ? "Choose a class first." : !subject ? "Choose a subject first." : "Fix the marks or time above to continue." });
      return;
    }
    if (!payload) return;
    setSubmitting(true);
    setSubmitState(null);
    try {
      const res = await fetch("/api/papers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = (await res.json()) as { id?: string; failure?: GenerateFailure; error?: string };
      if (res.status === 201) {
        router.push(`/paper/${data.id}`);
        return;
      }
      setSubmitState(data.failure ? { key: payloadKey, failure: data.failure } : { key: payloadKey, error: data.error ?? "The paper couldn't be built. Try again." });
    } catch {
      setSubmitState({ key: payloadKey, error: "The paper couldn't be built because the connection failed. Check your internet and try again." });
    }
    setSubmitting(false);
  }

  function toggleChapter(id: number) {
    setChapterIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const shownFailure = failure ?? (estLoading ? null : (est?.failure ?? null));
  const pyqShare =
    est?.projected && marks ? Math.round((est.projected.VERIFIED_PYQ.marks / Object.values(est.projected).reduce((s, v) => s + v.marks, 0)) * 100) : null;

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start xl:grid-cols-[1fr_24rem]">
      <div className="space-y-6">
        {/* Step 1: board and class */}
        <Step n={1} title="Board and class">
          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <div>
              <label htmlFor="board" className="field-label">
                Board
              </label>
              <select
                id="board"
                className="select"
                value={boardId}
                onChange={(e) => {
                  setBoardId(Number(e.target.value));
                  setClassId(undefined);
                  setSubjectId(undefined);
                  setChapterIds([]);
                }}
              >
                {catalog.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <p className="field-hint mt-1">CBSE is coming later.</p>
            </div>
            <fieldset>
              <legend className="field-label">Class</legend>
              <div className="grid grid-cols-3 gap-2">
                {[...(board?.classes ?? [])].reverse().map((c) => (
                  <label key={c.id} className="choice justify-center">
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
                    <span className="font-serif text-[1.15rem] font-semibold">{c.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </Step>

        {/* Step 2: subject */}
        <Step n={2} title="Subject" muted={!cls}>
          {!cls ? (
            <p className="text-pencil">Choose a class first.</p>
          ) : (
            <fieldset>
              <legend className="sr-only">Subject</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {cls.subjects.map((s) => (
                  <label key={s.id} className="choice">
                    <input
                      type="radio"
                      name="subject"
                      checked={subjectId === s.id}
                      onChange={() => {
                        setSubjectId(s.id);
                        setChapterIds([]);
                      }}
                    />
                    <span className="font-bold">{s.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </Step>

        {/* Step 3: chapters */}
        <Step n={3} title="Chapters" hint="Optional. Leave all unticked to cover the whole syllabus." muted={!subject}>
          {!subject ? (
            <p className="text-pencil">Choose a subject first.</p>
          ) : (
            <fieldset>
              <legend className="sr-only">Chapters for {subject.name}</legend>
              <div className="mb-3 flex flex-wrap items-center gap-3 text-[0.95rem]">
                <span className="font-bold" aria-live="polite">
                  {chapterIds.length === 0 ? "Whole syllabus" : `${chapterIds.length} of ${subject.chapters.length} chapters`}
                </span>
                {chapterIds.length > 0 && (
                  <button type="button" className="link font-bold" onClick={() => setChapterIds([])}>
                    Clear chapters
                  </button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {subject.chapters.map((c) => (
                  <label key={c.id} className="choice">
                    <input type="checkbox" checked={chapterIds.includes(c.id)} onChange={() => toggleChapter(c.id)} />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </Step>

        {/* Step 4: marks, time, difficulty */}
        <Step n={4} title="Marks, time and difficulty">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="marks" className="field-label">
                Total marks
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Common totals">
                {MARK_PRESETS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={marks === m}
                    onClick={() => changeMarks(m)}
                    className={`btn btn-sm num ${marks === m ? "btn-primary" : "btn-secondary"}`}
                  >
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
                {minutesValid
                  ? marksValid
                    ? `Board papers allow roughly 1.5 minutes a mark, about ${suggestedMinutes(marks)} minutes for ${marks} marks.`
                    : "Between 5 and 240 minutes."
                  : "Enter a time between 5 and 240 minutes."}
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
          </fieldset>
        </Step>

        {/* Step 5: mode */}
        <Step n={5} title="Paper mode">
          <fieldset>
            <legend className="sr-only">Paper mode</legend>
            <div className="grid gap-2">
              {MODES.map((m) => (
                <label key={m} className="choice">
                  <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
                  <span>
                    <span className="block font-bold">{MODE_LABELS[m].name}</span>
                    <span className="block text-[0.93rem] text-pencil">{MODE_LABELS[m].description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </Step>
      </div>

      {/* Summary + estimate */}
      <aside className="lg:sticky lg:top-24" aria-labelledby="summary-title">
        <div className="sheet p-5 sm:p-6">
          <h2 id="summary-title" className="text-[1.4rem]">
            Your paper
          </h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.95rem]">
            <dt className="text-pencil">Subject</dt>
            <dd className="font-bold">{subject ? `${board?.name} ${cls?.name} ${subject.name}` : "Not chosen"}</dd>
            <dt className="text-pencil">Scope</dt>
            <dd>{subject ? (chapterIds.length ? `${chapterIds.length} chapter${chapterIds.length > 1 ? "s" : ""}` : "Whole syllabus") : "–"}</dd>
            <dt className="text-pencil">Marks</dt>
            <dd className="num">{marksValid ? marks : "–"}</dd>
            <dt className="text-pencil">Time</dt>
            <dd className="num">{minutesValid ? `${minutes} min` : "–"}</dd>
            <dt className="text-pencil">Mode</dt>
            <dd>{MODE_LABELS[mode].name}</dd>
          </dl>

          <div className="mt-5 border-t border-rule pt-5" aria-live="polite" aria-busy={estLoading}>
            {!subject ? (
              <p className="text-[0.95rem] text-pencil">Choose a class and subject to see what&apos;s available.</p>
            ) : estError ? (
              <p className="field-error">{estError}</p>
            ) : !est ? (
              <p className="text-[0.95rem] text-pencil">Checking the question bank…</p>
            ) : (
              <div className={estLoading ? "opacity-60 transition-opacity" : "transition-opacity"}>
                <div className="grid grid-cols-2 gap-3">
                  <p>
                    <span className="block text-sm text-pencil">{mode === "PYQ_ONLY" ? "Verified PYQs available" : "Reviewed questions available"}</span>
                    <span className="num font-serif text-[1.7rem] font-semibold leading-tight">{est.eligibleCount}</span>
                    <span className="block text-sm text-pencil">{est.eligibleMarks} marks in total</span>
                  </p>
                  <p>
                    <span className="block text-sm text-pencil">{est.poolHasDemo ? "Estimated PYQ stand-in share" : "Estimated PYQ share"}</span>
                    <span className="num font-serif text-[1.7rem] font-semibold leading-tight">{pyqShare === null ? "–" : `${pyqShare}%`}</span>
                    <span className="block text-sm text-pencil">of marks</span>
                  </p>
                </div>
                {est.projected && (
                  <div className="mt-4">
                    <CompositionBar composition={est.projected} demo={est.poolHasDemo} caption="Expected make-up" />
                  </div>
                )}
                {est.poolHasDemo && (
                  <p className="demo-banner mt-4 px-3 py-2 text-[0.88rem] font-bold">
                    This bank contains demo data. No demo question is a real previous-year question.
                  </p>
                )}
              </div>
            )}
          </div>

          {shownFailure && subject && (
            <div role="alert" className="mt-5 rounded-md border-2 border-margin/60 bg-margin-soft p-4">
              <p className="font-bold text-graphite">
                {shownFailure.reason === "NO_QUESTIONS" ? "No questions available" : "Not enough questions for this paper"}
              </p>
              <p className="mt-1 text-[0.95rem]">{shownFailure.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {shownFailure.maxAchievableMarks >= 5 && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => changeMarks(shownFailure.maxAchievableMarks)}>
                    Make it {shownFailure.maxAchievableMarks} marks
                  </button>
                )}
                {mode === "PYQ_ONLY" && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode("PYQ_PRIORITY")}>
                    Switch to PYQ priority
                  </button>
                )}
                {chapterIds.length > 0 && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setChapterIds([])}>
                    Use the whole syllabus
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

          <button type="submit" className="btn btn-primary mt-5 w-full text-[1.05rem]" disabled={submitting || Boolean(subject && est?.failure)}>
            {submitting ? "Building your paper…" : "Build paper"}
          </button>
        </div>
      </aside>
    </form>
  );
}

function Step({ n, title, hint, muted, children }: { n: number; title: string; hint?: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <section className={`panel p-5 sm:p-6 ${muted ? "bg-sheet/70" : ""}`} aria-labelledby={`step-${n}`}>
      <div className="mb-4 flex items-baseline gap-3">
        <span className="num font-serif text-[1.35rem] font-semibold text-margin" aria-hidden="true">
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
