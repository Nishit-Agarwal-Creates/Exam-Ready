import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { QuestionType, SourceType } from "@/db/schema";
import { gradeSubmission, itemScore, summarise, worksheetSummary } from "@/lib/engine/scoring";
import { isRealVerifiedPyq } from "@/lib/provenance";
import { getPaper, type PaperView } from "./papers";

const { attempts, attemptAnswers } = schema;

export const attemptIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10,32}$/);

export const submitSchema = z.object({
  attemptId: attemptIdSchema,
  paperId: z.string().regex(/^[A-Za-z0-9_-]{6,32}$/),
  startedAt: z.string().datetime(),
  timeUsedSeconds: z.number().int().min(0).max(60 * 60 * 6),
  answers: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        response: z.string().max(10000).nullable(),
        markedForReview: z.boolean().default(false),
      }),
    )
    .max(200),
});
export type SubmitInput = z.infer<typeof submitSchema>;

export async function submitAttempt(input: SubmitInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = await getDb();
  const existingResult = async () => {
    const [existing] = await db.select({ id: attempts.id, paperId: attempts.generatedPaperId }).from(attempts).where(eq(attempts.id, input.attemptId));
    if (!existing) return null;
    // Repeat submissions (double click, refresh, retry after a network error) return the stored result; marks are never added twice.
    return existing.paperId === input.paperId ? ({ ok: true, id: existing.id } as const) : ({ ok: false, error: "This attempt belongs to another paper." } as const);
  };
  const before = await existingResult();
  if (before) return before;
  const paper = await getPaper(input.paperId, true);
  if (!paper) return { ok: false, error: "This paper no longer exists." };

  const graded = gradeSubmission(paper.items, input.answers);
  const limit = paper.durationMinutes * 60 + 120;
  const insertAttempt = db.insert(attempts).values({
    id: input.attemptId,
    generatedPaperId: paper.id,
    startedAt: input.startedAt,
    submittedAt: new Date().toISOString(),
    timeUsedSeconds: Math.min(input.timeUsedSeconds, limit),
    status: "SUBMITTED",
    maxScore: graded.maxScore,
    autoScore: graded.autoScore,
    selfScore: graded.selfScore,
  });
  const inserts = [];
  const rows = graded.rows.map((r) => ({ attemptId: input.attemptId, ...r }));
  for (let i = 0; i < rows.length; i += 12) inserts.push(db.insert(attemptAnswers).values(rows.slice(i, i + 12)));
  try {
    // One batch is one transaction: the attempt and all its answers are stored together or not at all.
    await db.batch([insertAttempt, ...inserts]);
  } catch (e) {
    // Two identical submissions racing: the second insert hits the attempt's primary key. Return the stored one.
    const after = await existingResult();
    if (after) return after;
    throw e;
  }
  return { ok: true, id: input.attemptId };
}

export const selfReviewSchema = z.object({
  marks: z.array(z.object({ questionId: z.number().int().positive(), marks: z.number().min(0).max(100) })).max(200),
});

export async function saveSelfReview(attemptId: string, marks: { questionId: number; marks: number }[]) {
  const db = await getDb();
  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
  if (!attempt) return { ok: false as const, error: "Attempt not found." };
  const paper = await getPaper(attempt.generatedPaperId, true);
  if (!paper) return { ok: false as const, error: "Paper not found." };
  // Practice worksheets are not scored: nothing in them can be self-marked.
  if (paper.kind === "WORKSHEET") return { ok: false as const, error: "Practice worksheets aren't scored, so their answers can't be marked." };
  // Only answers that weren't marked automatically when submitted can be self-marked (the stored method decides,
  // so a key added to a question later never locks or re-marks an earlier attempt). Unanswered ones stay 0.
  const stored = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId));
  const reviewable = new Set(stored.filter((a) => a.evaluationMethod !== "AUTO" && a.response !== null).map((a) => a.questionId));
  const maxById = new Map(paper.items.filter((i) => reviewable.has(i.question.id)).map((i) => [i.question.id, i.marks]));
  const updates = [];
  for (const m of marks) {
    const max = maxById.get(m.questionId);
    if (max === undefined) continue; // objective questions can't be self-marked
    const value = Math.round(Math.min(Math.max(m.marks, 0), max) * 2) / 2;
    updates.push(
      db
        .update(attemptAnswers)
        .set({ marksAwarded: value, evaluationMethod: "SELF" })
        .where(and(eq(attemptAnswers.attemptId, attemptId), eq(attemptAnswers.questionId, m.questionId))),
    );
  }
  if (updates.length) await db.batch(updates as [(typeof updates)[number], ...typeof updates]);
  const answers = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId));
  // The self-marked score is final only when every written answer has been marked; until then it stays empty, so
  // lists never present a partly marked attempt as complete.
  const stillPending = answers.some((a) => a.evaluationMethod === "NONE" && a.response !== null);
  const selfScore = stillPending ? null : answers.filter((a) => a.evaluationMethod === "SELF").reduce((s, a) => s + (a.marksAwarded ?? 0), 0);
  await db.update(attempts).set({ selfScore, updatedAt: new Date().toISOString() }).where(eq(attempts.id, attemptId));
  return { ok: true as const };
}

/** `answered*` count only questions the student attempted: a skipped question shows what wasn't reached, not a weakness. */
type Bucket = { key: string; label: string; max: number; scored: number; evaluatedMax: number; count: number; answeredScored: number; answeredMax: number; skipped: number };

function bump(map: Map<string, Bucket>, key: string, label: string, max: number, scored: number | null, answered: boolean) {
  const b = map.get(key) ?? { key, label, max: 0, scored: 0, evaluatedMax: 0, count: 0, answeredScored: 0, answeredMax: 0, skipped: 0 };
  b.max += max;
  b.count++;
  if (!answered) b.skipped++;
  if (scored !== null) {
    b.scored += scored;
    b.evaluatedMax += max;
    if (answered) {
      b.answeredScored += scored;
      b.answeredMax += max;
    }
  }
  map.set(key, b);
}

const TYPE_LABELS: Record<QuestionType, string> = {
  MCQ: "Multiple choice",
  ASSERTION_REASON: "Assertion–reason",
  FILL_BLANK: "Fill in the blank",
  NUMERICAL: "Numerical",
  SHORT_ANSWER: "Short answer",
  LONG_ANSWER: "Long answer",
  CASE_BASED: "Case-based",
};
export { TYPE_LABELS };

export type AttemptResult = Awaited<ReturnType<typeof getAttemptResult>>;

export async function getAttemptResult(id: string) {
  if (!attemptIdSchema.safeParse(id).success) return null;
  const db = await getDb();
  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, id));
  if (!attempt) return null;
  const paper = (await getPaper(attempt.generatedPaperId, true)) as PaperView;
  if (!paper) return null;
  const answers = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, id));
  const byQ = new Map(answers.map((a) => [a.questionId, a]));

  const chapters = new Map<string, Bucket>();
  const types = new Map<string, Bucket>();
  const sources = new Map<string, Bucket>();
  const sections = new Map<string, Bucket>();
  let attempted = 0,
    correct = 0,
    incorrect = 0,
    unanswered = 0,
    autoMax = 0,
    descriptiveMax = 0,
    descriptiveReviewed = 0,
    descriptiveTotal = 0,
    markedForReview = 0;

  const items = paper.items.map((item) => {
    const a = byQ.get(item.question.id);
    // How the answer was marked when it was submitted decides the bucket (see itemScore).
    const { auto, answered, scored } = itemScore(item.marks, a, item.question);
    if (a?.markedForReview) markedForReview++;
    if (answered) attempted++;
    else unanswered++;
    if (auto) {
      autoMax += item.marks;
      if (a?.isCorrect) correct++;
      else if (answered) incorrect++;
    } else {
      descriptiveMax += item.marks;
      descriptiveTotal++;
      if (a?.evaluationMethod === "SELF") descriptiveReviewed++;
    }
    bump(chapters, String(item.question.chapter.id), item.question.chapter.name, item.marks, scored, answered);
    bump(types, item.question.type, TYPE_LABELS[item.question.type], item.marks, scored, answered);
    const cat: SourceType = isRealVerifiedPyq(item.question) ? "VERIFIED_PYQ" : item.question.sourceType === "VERIFIED_PYQ" ? "PENDING_REVIEW" : item.question.sourceType;
    const srcKey = item.question.isDemo ? `DEMO_${cat}` : cat;
    bump(sources, srcKey, srcKey, item.marks, scored, answered);
    if (item.section) bump(sections, item.section, `Section ${item.section}`, item.marks, scored, answered);
    return { ...item, answer: a ?? null, scored, auto };
  });

  const totals = summarise(items);
  const worksheet = paper.kind === "WORKSHEET" ? worksheetSummary(items.map((i) => ({ marks: i.marks, auto: i.auto, answered: Boolean(i.answer?.response), correct: i.answer?.isCorrect ?? null }))) : null;

  const chapterList = [...chapters.values()].sort((a, b) => a.label.localeCompare(b.label));
  // Weak = under 60% on the questions actually answered (and marked). Chapters only skipped are listed separately.
  const weak = chapterList
    .filter((c) => c.answeredMax > 0 && c.answeredScored / c.answeredMax < 0.6)
    .sort((a, b) => a.answeredScored / a.answeredMax - b.answeredScored / b.answeredMax);
  const notReached = chapterList.filter((c) => c.skipped === c.count);

  return {
    attempt,
    paper,
    items,
    summary: {
      scored: totals.scored,
      evaluatedMax: totals.evaluatedMax,
      // The maximum is the sum of the paper's question marks (equal to the stored paper total).
      max: totals.max,
      pendingReview: totals.pending,
      // Worksheets have no final score or percentage (see `worksheet`).
      final: worksheet ? false : totals.final,
      percent: worksheet ? null : totals.percent,
      attempted,
      unanswered,
      correct,
      incorrect,
      autoMax,
      descriptiveMax,
      descriptiveTotal,
      descriptiveReviewed,
      markedForReview,
      accuracy: correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 100) : null,
    },
    /** Present for practice worksheets: what was checked, and what was not graded. */
    worksheet,
    chapters: chapterList,
    types: [...types.values()],
    sections: [...sections.values()].sort((a, b) => a.key.localeCompare(b.key)),
    sources: [...sources.values()] as (Bucket & { key: SourceType | `DEMO_${SourceType}` })[],
    weak,
    notReached,
  };
}

export async function getAttemptSummaries(ids: string[]) {
  const valid = ids.filter((i) => attemptIdSchema.safeParse(i).success).slice(0, 50);
  if (!valid.length) return [];
  const db = await getDb();
  return db
    .select({
      id: attempts.id,
      paperId: attempts.generatedPaperId,
      submittedAt: attempts.submittedAt,
      maxScore: attempts.maxScore,
      autoScore: attempts.autoScore,
      selfScore: attempts.selfScore,
      timeUsedSeconds: attempts.timeUsedSeconds,
      title: schema.generatedPapers.title,
      mode: schema.generatedPapers.mode,
      kind: schema.generatedPapers.kind,
      hasDemo: schema.generatedPapers.hasDemo,
    })
    .from(attempts)
    .innerJoin(schema.generatedPapers, eq(attempts.generatedPaperId, schema.generatedPapers.id))
    .where(inArray(attempts.id, valid));
}
