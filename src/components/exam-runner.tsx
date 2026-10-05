"use client";

import Link from "next/link";
import { MathText } from "./math-text";
import { isIndented } from "@/lib/math-markup";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PaperMode, QuestionType, SourceType, VerificationStatus } from "@/db/schema";
import type { SourceLink } from "@/lib/provenance";
import { rememberAttempt } from "@/lib/history";
import { randomId } from "@/lib/text";
import { Logo } from "./logo";
import { SourceStamp } from "./provenance";
import { TYPE_NAMES } from "./question-block";

export type ExamQuestion = {
  id: number;
  number: number;
  section: string;
  marks: number;
  text: string;
  type: QuestionType;
  options: string[] | null;
  chapter: string;
  isDemo: boolean;
  sourceType: SourceType;
  verificationStatus: VerificationStatus;
  sources: SourceLink[];
  hasFigure?: boolean;
  figureSource?: { paperId: number; page: number | null } | null;
  /** Figures cropped from the original source page. */
  figures?: { src: string; alt: string; width: number; height: number; page: number }[];
};

type ExamPaper = { id: string; title: string; scope: string; totalMarks: number; durationMinutes: number; hasDemo: boolean; mode: PaperMode };

type Saved = {
  attemptId: string;
  startedAt: string;
  answers: Record<number, string>;
  review: number[];
  current: number;
};

const LETTERS = ["a", "b", "c", "d", "e", "f"];
const storageKey = (paperId: string) => `er:attempt:${paperId}`;

function load(paperId: string): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(paperId));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}
function save(paperId: string, s: Saved) {
  try {
    localStorage.setItem(storageKey(paperId), JSON.stringify(s));
  } catch {
    /* storage full or blocked: the test still works, it just can't be resumed */
  }
}
function clock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function ExamRunner({ paper, questions }: { paper: ExamPaper; questions: ExamQuestion[] }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "intro" | "running" | "submitting">("loading");
  const [state, setState] = useState<Saved | null>(null);
  const [resumed, setResumed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const autoSubmitted = useRef(false);

  // Restoring from localStorage has to wait until after hydration, because the server can't see it.
  useEffect(() => {
    const saved = load(paper.id);
    if (saved && saved.attemptId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage after mount
      setState(saved);
      setResumed(true);
      setPhase("running");
    } else {
      setPhase("intro");
    }
  }, [paper.id]);

  useEffect(() => {
    if (state && phase === "running") save(paper.id, state);
  }, [state, phase, paper.id]);

  const deadline = state ? new Date(state.startedAt).getTime() + paper.durationMinutes * 60_000 : 0;
  const remaining = state ? Math.max(0, (deadline - now) / 1000) : paper.durationMinutes * 60;

  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Warn before leaving mid-test (progress is saved, but the timer keeps running).
  useEffect(() => {
    if (phase !== "running") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  const answeredCount = useMemo(() => (state ? questions.filter((q) => (state.answers[q.id] ?? "").trim() !== "").length : 0), [state, questions]);

  const submit = useCallback(async () => {
    if (!state) return;
    setPhase("submitting");
    setSubmitError(null);
    dialogRef.current?.close();
    const timeUsedSeconds = Math.min(Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000), paper.durationMinutes * 60);
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: state.attemptId,
          paperId: paper.id,
          startedAt: state.startedAt,
          timeUsedSeconds,
          answers: questions.map((q) => ({
            questionId: q.id,
            response: state.answers[q.id]?.trim() ? state.answers[q.id] : null,
            markedForReview: state.review.includes(q.id),
          })),
        }),
      });
      const data = (await res.json()) as { id: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      rememberAttempt(data.id);
      try {
        localStorage.removeItem(storageKey(paper.id));
      } catch {
        /* ignore */
      }
      router.replace(`/results/${data.id}`);
    } catch (e) {
      setSubmitError(
        e instanceof Error && e.message !== "Failed to fetch"
          ? `Your answers weren't submitted: ${e.message}. They are still saved on this device.`
          : "Your answers weren't submitted because the connection failed. They are still saved on this device. Try again.",
      );
      setPhase("running");
    }
  }, [state, paper.id, paper.durationMinutes, questions, router]);

  // Announced by the live region only when the text changes.
  const timeWarning =
    phase !== "running" ? "" : remaining <= 0 ? "Time is up. Submitting your answers." : remaining <= 60 ? "One minute left." : remaining <= 300 ? "Five minutes left." : "";

  // Auto-submit when time runs out.
  useEffect(() => {
    if (phase === "running" && state && remaining <= 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void submit();
    }
  }, [remaining, phase, state, submit]);

  function start() {
    const s: Saved = { attemptId: randomId(12), startedAt: new Date().toISOString(), answers: {}, review: [], current: 0 };
    setState(s);
    setNow(Date.now());
    setPhase("running");
  }

  function goTo(index: number) {
    if (!state) return;
    const i = Math.min(Math.max(index, 0), questions.length - 1);
    setState({ ...state, current: i });
    setPaletteOpen(false);
    requestAnimationFrame(() => questionRef.current?.focus());
  }

  function setAnswer(qid: number, value: string) {
    setState((s) => (s ? { ...s, answers: { ...s.answers, [qid]: value } } : s));
  }
  function toggleReview(qid: number) {
    setState((s) => (s ? { ...s, review: s.review.includes(qid) ? s.review.filter((x) => x !== qid) : [...s.review, qid] } : s));
  }

  if (phase === "loading") {
    return (
      <main className="grid min-h-dvh place-items-center" aria-busy="true">
        <p className="text-pencil">Loading your test…</p>
      </main>
    );
  }

  if (phase === "intro" || !state) {
    const counts = questions.reduce<Record<string, number>>((acc, q) => ((acc[TYPE_NAMES[q.type]] = (acc[TYPE_NAMES[q.type]] ?? 0) + 1), acc), {});
    return (
      <main id="main" className="min-h-dvh py-8 sm:py-14">
        <div className="container-page max-w-3xl">
          <Link href={`/paper/${paper.id}`} className="inline-flex" aria-label="Back to the paper">
            <Logo />
          </Link>
          <div className="sheet sheet-ruled mt-6 py-8 pr-6 sm:pr-10">
            <h1 className="text-[1.9rem] sm:text-[2.3rem]">{paper.title}</h1>
            <p className="mt-1 font-serif text-[1.1rem] text-pencil">{paper.scope}</p>
            <dl className="mt-6 grid grid-cols-3 gap-4 border-y border-rule py-4">
              <div>
                <dt className="text-sm text-pencil">Questions</dt>
                <dd className="num font-serif text-[1.6rem] font-semibold">{questions.length}</dd>
              </div>
              <div>
                <dt className="text-sm text-pencil">Marks</dt>
                <dd className="num font-serif text-[1.6rem] font-semibold">{paper.totalMarks}</dd>
              </div>
              <div>
                <dt className="text-sm text-pencil">Time</dt>
                <dd className="num font-serif text-[1.6rem] font-semibold">{paper.durationMinutes} min</dd>
              </div>
            </dl>
            <h2 className="mt-6 font-sans text-[1.05rem] font-bold">Before you start</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[1rem]">
              <li>The timer starts when you press Start and keeps running if you close the page.</li>
              <li>Your answers save on this device as you go, so you can reopen the test and continue.</li>
              <li>Multiple choice, fill in the blank and numerical answers are marked automatically.</li>
              <li>Written answers are marked by you afterwards, using the model answer.</li>
              <li>When time runs out, your answers are submitted automatically.</li>
            </ul>
            <p className="mt-4 text-[0.95rem] text-pencil">
              {Object.entries(counts)
                .map(([k, v]) => `${v} ${k.toLowerCase()}`)
                .join(", ")}
            </p>
            {paper.hasDemo && (
              <p className="ai-note mt-5 px-4 py-3 text-[0.95rem]">
                <strong>Includes AI practice questions.</strong> Written by AI for practice; not from any exam.
              </p>
            )}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="button" className="btn btn-primary px-8 text-[1.05rem]" onClick={start}>
                Start test
              </button>
              <Link href={`/paper/${paper.id}`} className="btn btn-secondary">
                Back to paper
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const q = questions[state.current];
  const answer = state.answers[q.id] ?? "";
  const inReview = state.review.includes(q.id);
  const low = remaining <= 300;
  const unansweredCount = questions.length - answeredCount;
  const reviewCount = state.review.length;

  const palette = (
    <div>
      <p className="mb-3 text-[0.95rem] font-bold">
        <span className="num">{answeredCount}</span> of <span className="num">{questions.length}</span> answered
      </p>
      <ol className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5">
        {questions.map((qq, i) => {
          const answered = (state.answers[qq.id] ?? "").trim() !== "";
          const review = state.review.includes(qq.id);
          const current = i === state.current;
          const label = `Question ${qq.number}${answered ? ", answered" : ", not answered"}${review ? ", marked for review" : ""}`;
          return (
            <li key={qq.id}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={label}
                aria-current={current ? "step" : undefined}
                className={`relative grid h-11 w-full place-items-center rounded-md border-2 text-[0.95rem] font-bold num transition-colors ${
                  answered ? "border-ink bg-ink text-white" : "border-rule-strong bg-sheet text-graphite hover:border-pencil"
                } ${current ? "ring-2 ring-margin ring-offset-2" : ""}`}
              >
                {qq.number}
                {review && <span aria-hidden="true" className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-sheet bg-margin" />}
              </button>
            </li>
          );
        })}
      </ol>
      <ul className="mt-4 space-y-1.5 text-[0.85rem] text-pencil">
        <li className="flex items-center gap-2">
          <span className="size-3.5 rounded-sm bg-ink" aria-hidden="true" /> Answered
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3.5 rounded-sm border-2 border-rule-strong bg-sheet" aria-hidden="true" /> Not answered
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-margin" aria-hidden="true" /> Marked for review
        </li>
      </ul>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-rule bg-sheet">
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-bold">{paper.title}</p>
            <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-desk-deep sm:w-48" aria-hidden="true">
              <div className="h-full bg-ink transition-[width]" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <p
              className={`num rounded-md px-3 py-1.5 font-serif text-[1.35rem] font-semibold leading-none ${low ? "bg-margin-soft text-margin" : "text-graphite"}`}
              role="timer"
              aria-label={`Time left ${Math.ceil(remaining / 60)} minutes`}
            >
              {clock(remaining)}
            </p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => dialogRef.current?.showModal()} disabled={phase === "submitting"}>
              {phase === "submitting" ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      </header>
      <p className="sr-only" aria-live="assertive">
        {timeWarning}
      </p>

      <main id="main" className="container-page flex-1 py-5 sm:py-8">
        {resumed && (
          <p className="mb-4 rounded-md border border-ink-line bg-ink-soft px-4 py-2.5 text-[0.95rem]">
            You&apos;re continuing a saved attempt. Your earlier answers are restored.{" "}
            <button type="button" className="link font-bold" onClick={() => setResumed(false)}>
              Dismiss
            </button>
          </p>
        )}
        {submitError && (
          <p role="alert" className="mb-4 rounded-md border-2 border-margin/60 bg-margin-soft px-4 py-3 font-bold">
            {submitError}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_17rem] lg:items-start">
          <section className="sheet sheet-ruled min-w-0 py-6 pr-4 sm:py-8 sm:pr-8" aria-labelledby="current-q">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 id="current-q" ref={questionRef} tabIndex={-1} className="font-serif text-[1.3rem] font-semibold outline-none">
                Question {q.number}
                <span className="sr-only"> of {questions.length}</span>
                {q.section && <span className="ml-2 text-[1rem] font-normal text-pencil">Section {q.section}</span>}
              </h1>
              <p className="marks text-[1.1rem]">
                [{q.marks} {q.marks === 1 ? "mark" : "marks"}]
              </p>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.88rem] text-pencil">
              <span>{TYPE_NAMES[q.type]}</span>
              {q.isDemo && <SourceStamp q={q} compact />}
            </p>

            <p className="paper-text mt-4 text-[1.12rem]" data-indented={isIndented(q.text) || undefined}>
              <MathText text={q.text} />
            </p>
            {q.figures?.map((f) => (
              <figure key={f.src} className="source-figure mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- static crops of the source page */}
                <img src={f.src} alt={f.alt} width={f.width} height={f.height} decoding="async" />
                <figcaption>From the original paper, page {f.page}.</figcaption>
              </figure>
            ))}
            {q.hasFigure && !q.figures?.length && (
              <p className="mt-3 rounded-lg bg-contrib-soft/70 px-3 py-2 text-[0.92rem] text-contrib">
                This question uses a figure or table that isn&apos;t reproduced here.
                {q.figureSource && (
                  <>
                    {" "}
                    <a href={`/sources/${q.figureSource.paperId}`} target="_blank" rel="noopener" className="link font-bold">
                      Open the source paper{q.figureSource.page ? ` (page ${q.figureSource.page})` : ""}
                    </a>{" "}
                    in a new tab.
                  </>
                )}
              </p>
            )}

            <div className="mt-6">
              {(q.type === "MCQ" || q.type === "ASSERTION_REASON") && q.options && q.options.length > 0 ? (
                <fieldset>
                  <legend className="sr-only">Choose one answer</legend>
                  <div className="grid gap-2">
                    {q.options.map((o, i) => (
                      <label key={i} className="choice exam-option fx-spring text-[1.03rem]" data-fx="ripple">
                        <input type="radio" name={`q-${q.id}`} checked={answer === String(i)} onChange={() => setAnswer(q.id, String(i))} />
                        <span>
                          <span className="font-bold">({LETTERS[i]})</span> <MathText text={o} />
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : q.type === "FILL_BLANK" || q.type === "NUMERICAL" ? (
                <div className="max-w-md">
                  <label htmlFor={`a-${q.id}`} className="field-label">
                    {q.type === "NUMERICAL" ? "Your final answer" : "Your answer"}
                  </label>
                  <input
                    id={`a-${q.id}`}
                    className="input"
                    inputMode={q.type === "NUMERICAL" ? "decimal" : "text"}
                    autoComplete="off"
                    spellCheck={q.type !== "NUMERICAL"}
                    value={answer}
                    maxLength={500}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    aria-describedby={`h-${q.id}`}
                  />
                  <p id={`h-${q.id}`} className="field-hint mt-1">
                    {q.type === "NUMERICAL" ? "Enter a number. You can include the unit, for example 12.5 cm." : "A word or short phrase."}
                  </p>
                </div>
              ) : (
                <div>
                  <label htmlFor={`a-${q.id}`} className="field-label">
                    Your answer
                  </label>
                  <textarea
                    id={`a-${q.id}`}
                    className="textarea font-serif text-[1.05rem]"
                    rows={q.type === "LONG_ANSWER" ? 10 : 5}
                    value={answer}
                    maxLength={10000}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    aria-describedby={`h-${q.id}`}
                  />
                  <p id={`h-${q.id}`} className="field-hint mt-1">
                    You&apos;ll compare this with the model answer and mark it yourself after submitting.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
              <button type="button" className={`btn btn-sm btn-secondary ${inReview ? "review-on" : ""}`} aria-pressed={inReview} onClick={() => toggleReview(q.id)}>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill={inReview ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M5 21V4h11l-2 4 2 4H5" />
                </svg>
                {inReview ? "Marked for review" : "Mark for review"}
              </button>
              {answer && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAnswer(q.id, "")}>
                  Clear answer
                </button>
              )}
            </div>
          </section>

          <aside className="hidden lg:block lg:sticky lg:top-24" aria-label="Question navigation">
            <div className="sheet p-4">{palette}</div>
          </aside>
        </div>
      </main>

      {/* Bottom navigation */}
      <nav className="sticky bottom-0 z-30 border-t border-rule bg-sheet pb-[env(safe-area-inset-bottom)]" aria-label="Previous and next question">
        {paletteOpen && (
          <div className="container-page max-h-[55dvh] overflow-y-auto overscroll-contain border-b border-rule py-4 lg:hidden" id="palette-mobile">
            {palette}
          </div>
        )}
        <div className="container-page flex h-16 items-center justify-between gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => goTo(state.current - 1)} disabled={state.current === 0}>
            Previous
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm lg:hidden"
            aria-expanded={paletteOpen}
            aria-controls="palette-mobile"
            onClick={() => setPaletteOpen((o) => !o)}
          >
            <span className="num">
              {state.current + 1} / {questions.length}
            </span>
            <span>{paletteOpen ? "Close" : "All questions"}</span>
          </button>
          <p className="num hidden text-[0.95rem] text-pencil lg:block">
            Question {state.current + 1} of {questions.length}
          </p>
          {state.current < questions.length - 1 ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => goTo(state.current + 1)}>
              Next
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => dialogRef.current?.showModal()}>
              Finish
            </button>
          )}
        </div>
      </nav>

      <dialog ref={dialogRef} className="modal" aria-labelledby="submit-title">
        <div className="p-6">
          <h2 id="submit-title" className="text-[1.5rem]">
            Submit your test?
          </h2>
          <p className="mt-2 text-pencil">You can&apos;t change your answers after submitting.</p>
          <ul className="mt-4 space-y-1.5">
            <li className="flex justify-between border-b border-rule pb-1.5">
              <span>Answered</span>
              <strong className="num">{answeredCount}</strong>
            </li>
            <li className={`flex justify-between border-b border-rule pb-1.5 ${unansweredCount ? "text-margin" : ""}`}>
              <span>Not answered</span>
              <strong className="num">{unansweredCount}</strong>
            </li>
            <li className="flex justify-between pb-1.5">
              <span>Marked for review</span>
              <strong className="num">{reviewCount}</strong>
            </li>
          </ul>
          <p className="mt-3 text-[0.95rem] text-pencil">Time left: {clock(remaining)}</p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn btn-secondary" onClick={() => dialogRef.current?.close()} autoFocus>
              Keep working
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void submit()}>
              Submit test
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
