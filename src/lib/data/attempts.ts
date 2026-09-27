import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { QuestionType, SourceType } from "@/db/schema";
import { evaluate, isAutoGraded } from "@/lib/engine/grading";
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
  const [existing] = await db.select({ id: attempts.id, paperId: attempts.generatedPaperId }).from(attempts).where(eq(attempts.id, input.attemptId));
  if (existing) {
    // Repeat submissions (double click, retry after a network error) return the stored result.
    return existing.paperId === input.paperId ? { ok: true, id: existing.id } : { ok: false, error: "This attempt belongs to another paper." };
  }
  const paper = await getPaper(input.paperId, true);
  if (!paper) return { ok: false, error: "This paper no longer exists." };

  const responses = new Map(input.answers.map((a) => [a.questionId, a]));
  let autoScore = 0;
  const rows = paper.items.map((item) => {
    const given = responses.get(item.question.id);
    const response = given?.response?.trim() ? given.response.trim() : null;
    const result = evaluate(item.question.type, item.question.answer?.key ?? null, item.marks, response);
    if (result.marksAwarded) autoScore += result.marksAwarded;
    return {
      attemptId: input.attemptId,
      questionId: item.question.id,
      position: item.position,
      response,
      isCorrect: result.isCorrect,
      marksAwarded: result.marksAwarded,
      evaluationMethod: result.method,
      markedForReview: given?.markedForReview ?? false,
    };
  });
  const limit = paper.durationMinutes * 60 + 120;
  // Nothing to self-review when no written answer was given, so the attempt is fully marked.
  const pendingWritten = rows.some((r) => r.evaluationMethod === "NONE" && r.response !== null);
  const insertAttempt = db.insert(attempts).values({
    id: input.attemptId,
    generatedPaperId: paper.id,
    startedAt: input.startedAt,
    submittedAt: new Date().toISOString(),
    timeUsedSeconds: Math.min(input.timeUsedSeconds, limit),
    status: "SUBMITTED",
    maxScore: paper.totalMarks,
    autoScore,
    selfScore: pendingWritten ? null : 0,
  });
  const inserts = [];
  for (let i = 0; i < rows.length; i += 12) inserts.push(db.insert(attemptAnswers).values(rows.slice(i, i + 12)));
  await db.batch([insertAttempt, ...inserts]);
  return { ok: true, id: input.attemptId };
}

export const selfReviewSchema = z.object({
  marks: z.array(z.object({ questionId: z.number().int().positive(), marks: z.number().min(0).max(100) })).max(200),
});

export async function saveSelfReview(attemptId: string, marks: { questionId: number; marks: number }[]) {
  const db = await getDb();
  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
  if (!attempt) return { ok: false as const, error: "Attempt not found." };
  const paper = await getPaper(attempt.generatedPaperId, false);
  if (!paper) return { ok: false as const, error: "Paper not found." };
  const maxById = new Map(paper.items.filter((i) => !isAutoGraded(i.question.type)).map((i) => [i.question.id, i.marks]));
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
  const selfScore = answers.filter((a) => a.evaluationMethod === "SELF").reduce((s, a) => s + (a.marksAwarded ?? 0), 0);
  await db.update(attempts).set({ selfScore, updatedAt: new Date().toISOString() }).where(eq(attempts.id, attemptId));
  return { ok: true as const };
}

type Bucket = { key: string; label: string; max: number; scored: number; evaluatedMax: number; count: number };

function bump(map: Map<string, Bucket>, key: string, label: string, max: number, scored: number | null) {
  const b = map.get(key) ?? { key, label, max: 0, scored: 0, evaluatedMax: 0, count: 0 };
  b.max += max;
  b.count++;
  if (scored !== null) {
    b.scored += scored;
    b.evaluatedMax += max;
  }
  map.set(key, b);
}

const TYPE_LABELS: Record<QuestionType, string> = {
  MCQ: "Multiple choice",
  FILL_BLANK: "Fill in the blank",
  NUMERICAL: "Numerical",
  SHORT_ANSWER: "Short answer",
  LONG_ANSWER: "Long answer",
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
  let attempted = 0,
    correct = 0,
    incorrect = 0,
    unanswered = 0,
    autoMax = 0,
    descriptiveMax = 0,
    descriptiveReviewed = 0,
    descriptiveTotal = 0;

  const items = paper.items.map((item) => {
    const a = byQ.get(item.question.id);
    const auto = isAutoGraded(item.question.type);
    const answered = Boolean(a?.response);
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
    // Unanswered descriptive questions score 0 without needing review.
    const scored = auto ? (a?.marksAwarded ?? 0) : a?.evaluationMethod === "SELF" ? (a.marksAwarded ?? 0) : answered ? null : 0;
    bump(chapters, String(item.question.chapter.id), item.question.chapter.name, item.marks, scored);
    bump(types, item.question.type, TYPE_LABELS[item.question.type], item.marks, scored);
    const srcKey = item.question.isDemo ? `DEMO_${item.question.sourceType}` : item.question.sourceType;
    bump(sources, srcKey, srcKey, item.marks, scored);
    return { ...item, answer: a ?? null, scored };
  });

  const evaluated = items.filter((i) => i.scored !== null);
  const scoredTotal = evaluated.reduce((s, i) => s + (i.scored ?? 0), 0);
  const evaluatedMax = evaluated.reduce((s, i) => s + i.marks, 0);
  const pendingReview = items.filter((i) => i.scored === null).length;

  const chapterList = [...chapters.values()].sort((a, b) => a.label.localeCompare(b.label));
  const weak = chapterList
    .filter((c) => c.evaluatedMax > 0 && c.scored / c.evaluatedMax < 0.6)
    .sort((a, b) => a.scored / a.evaluatedMax - b.scored / b.evaluatedMax);

  return {
    attempt,
    paper,
    items,
    summary: {
      scored: scoredTotal,
      evaluatedMax,
      max: paper.totalMarks,
      pendingReview,
      attempted,
      unanswered,
      correct,
      incorrect,
      autoMax,
      descriptiveMax,
      descriptiveTotal,
      descriptiveReviewed,
    },
    chapters: chapterList,
    types: [...types.values()],
    sources: [...sources.values()] as (Bucket & { key: SourceType | `DEMO_${SourceType}` })[],
    weak,
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
      hasDemo: schema.generatedPapers.hasDemo,
    })
    .from(attempts)
    .innerJoin(schema.generatedPapers, eq(attempts.generatedPaperId, schema.generatedPapers.id))
    .where(inArray(attempts.id, valid));
}
