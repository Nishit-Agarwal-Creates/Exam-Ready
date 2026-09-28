import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { type AnswerSource, DIFFICULTIES, PAPER_TYPES, QUESTION_TYPES, SOURCE_AUTHORITIES, SOURCE_STATUSES, SOURCE_TYPES, VERIFICATION_STATUSES } from "@/db/schema";
import { parsePaperText, suggestChapter } from "@/lib/engine/ingest";
import { validateProvenance, type SourceLink } from "@/lib/provenance";
import { contentHash, similarity } from "@/lib/text";
import { chunk, getSourcesFor, refreshFrequency } from "./questions";

const { questions, questionSources, papers, subjects, classes, chapters, topics, importBatches, importItems, generatedPapers, attempts } = schema;

// ───────────────────────────── Dashboard ─────────────────────────────

export async function getDashboard() {
  const db = await getDb();
  const [bySource, bySubject, [paperCount], [genCount], [attemptCount], [pendingImports]] = await Promise.all([
    db
      .select({ sourceType: questions.sourceType, status: questions.verificationStatus, isDemo: questions.isDemo, n: sql<number>`count(*)` })
      .from(questions)
      .groupBy(questions.sourceType, questions.verificationStatus, questions.isDemo),
    db
      .select({
        subjectId: subjects.id,
        subject: subjects.name,
        cls: classes.name,
        n: sql<number>`count(${questions.id})`,
        verified: sql<number>`sum(case when ${questions.verificationStatus} = 'VERIFIED' then 1 else 0 end)`,
        realPyq: sql<number>`sum(case when ${questions.sourceType} = 'VERIFIED_PYQ' and ${questions.verificationStatus} = 'VERIFIED' and ${questions.isDemo} = 0 then 1 else 0 end)`,
      })
      .from(subjects)
      .innerJoin(classes, eq(subjects.classId, classes.id))
      .leftJoin(questions, eq(questions.subjectId, subjects.id))
      .groupBy(subjects.id)
      .orderBy(asc(classes.level), asc(subjects.sortOrder)),
    db.select({ n: sql<number>`count(*)` }).from(papers),
    db.select({ n: sql<number>`count(*)` }).from(generatedPapers),
    db.select({ n: sql<number>`count(*)` }).from(attempts),
    db.select({ n: sql<number>`count(*)` }).from(importItems).where(eq(importItems.status, "PENDING")),
  ]);
  return {
    bySource: bySource.map((r) => ({ ...r, n: Number(r.n) })),
    bySubject: bySubject.map((r) => ({ ...r, n: Number(r.n), verified: Number(r.verified ?? 0), realPyq: Number(r.realPyq ?? 0) })),
    papers: Number(paperCount.n),
    generated: Number(genCount.n),
    attempts: Number(attemptCount.n),
    pendingImports: Number(pendingImports.n),
  };
}

// ───────────────────────────── Questions ─────────────────────────────

const lines = (v: string) =>
  v
    .split(/\n|,/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const questionInputSchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    subjectId: z.coerce.number().int().positive({ message: "Choose a subject." }),
    chapterId: z.coerce.number().int().positive({ message: "Choose a chapter." }),
    topicId: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
    questionType: z.enum(QUESTION_TYPES),
    marks: z.coerce.number().int().min(1, "Marks must be at least 1.").max(20, "Marks can be at most 20."),
    difficulty: z.enum([...DIFFICULTIES, "UNRATED"]),
    questionText: z.string().trim().min(5, "Enter the question text.").max(5000),
    options: z.array(z.string().trim().max(500)).max(6).default([]),
    correctOption: z.coerce.number().int().min(0).max(5).optional(),
    acceptedAnswers: z.string().max(1000).default(""),
    numericValue: z.string().max(40).default(""),
    numericTolerance: z.string().max(40).default(""),
    numericUnit: z.string().max(40).default(""),
    answerText: z.string().max(10000).default(""),
    explanation: z.string().max(5000).default(""),
    sourceType: z.enum(SOURCE_TYPES),
    verificationStatus: z.enum(VERIFICATION_STATUSES),
    verificationNotes: z.string().max(2000).default(""),
    isPublished: z.boolean().default(true),
    // Optional: link a source paper in the same save.
    linkPaperId: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
    linkQuestionNumber: z.string().trim().max(20).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.questionType === "MCQ" || v.questionType === "ASSERTION_REASON") {
      const filled = v.options.filter(Boolean);
      if (filled.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "Option questions need at least two options." });
      // The correct option is optional: leave it blank when no official answer key exists.
      if (v.correctOption !== undefined && !v.options[v.correctOption])
        ctx.addIssue({ code: "custom", path: ["correctOption"], message: "The selected correct option is empty." });
    }
    if (v.questionType === "FILL_BLANK" && lines(v.acceptedAnswers).length === 0)
      ctx.addIssue({ code: "custom", path: ["acceptedAnswers"], message: "Add at least one accepted answer." });
    if (v.questionType === "NUMERICAL" && !Number.isFinite(Number(v.numericValue)))
      ctx.addIssue({ code: "custom", path: ["numericValue"], message: "Enter the correct numeric answer." });
  });
export type QuestionInput = z.infer<typeof questionInputSchema>;

export type SaveResult = { ok: true; id: number } | { ok: false; errors: Record<string, string> };

export async function saveQuestion(input: QuestionInput, actor: string): Promise<SaveResult> {
  const db = await getDb();
  // Referential checks: chapter belongs to subject, topic belongs to chapter.
  const [ch] = await db
    .select({ id: chapters.id, subjectId: chapters.subjectId, classId: subjects.classId, boardId: classes.boardId })
    .from(chapters)
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .innerJoin(classes, eq(subjects.classId, classes.id))
    .where(eq(chapters.id, input.chapterId));
  if (!ch || ch.subjectId !== input.subjectId) return { ok: false, errors: { chapterId: "That chapter doesn't belong to the chosen subject." } };
  if (input.topicId) {
    const [tp] = await db.select({ chapterId: topics.chapterId }).from(topics).where(eq(topics.id, input.topicId));
    if (!tp || tp.chapterId !== input.chapterId) return { ok: false, errors: { topicId: "That topic doesn't belong to the chosen chapter." } };
  }

  let existing: typeof questions.$inferSelect | undefined;
  if (input.id) {
    [existing] = await db.select().from(questions).where(eq(questions.id, input.id));
    if (!existing) return { ok: false, errors: { form: "This question no longer exists." } };
  }
  const isDemo = existing?.isDemo ?? false;

  // Work out the sources this question will have after the save, then apply the provenance rule.
  const sources: SourceLink[] = existing ? ((await getSourcesFor([existing.id])).get(existing.id) ?? []) : [];
  let linkPaper: typeof papers.$inferSelect | undefined;
  if (input.linkPaperId) {
    [linkPaper] = await db.select().from(papers).where(eq(papers.id, input.linkPaperId));
    if (!linkPaper || linkPaper.subjectId !== input.subjectId) return { ok: false, errors: { linkPaperId: "Choose a source paper for this subject." } };
    if (!sources.some((s) => s.paperId === linkPaper!.id)) {
      sources.push({
        paperId: linkPaper.id,
        title: linkPaper.title,
        year: linkPaper.year,
        paperType: linkPaper.paperType,
        sourceUrl: linkPaper.sourceUrl,
        questionNumber: input.linkQuestionNumber || null,
        isDemo: linkPaper.isDemo,
      });
    }
  }
  const provenanceError = validateProvenance(
    { sourceType: input.sourceType, verificationStatus: input.verificationStatus, isDemo, sources },
    existing ? { sourceType: existing.sourceType, answerSource: existing.answerSource } : undefined,
  );
  if (provenanceError) return { ok: false, errors: { verificationStatus: provenanceError } };

  let options: string | null = null;
  let answerKey: string | null = null;
  if (input.questionType === "MCQ" || input.questionType === "ASSERTION_REASON") {
    const opts = input.options.filter(Boolean);
    options = JSON.stringify(opts);
    answerKey = input.correctOption === undefined ? null : JSON.stringify({ correctOption: Math.min(input.correctOption, opts.length - 1) });
  } else if (input.questionType === "FILL_BLANK") {
    answerKey = JSON.stringify({ accepted: lines(input.acceptedAnswers) });
  } else if (input.questionType === "NUMERICAL") {
    answerKey = JSON.stringify({ value: Number(input.numericValue), tolerance: Math.abs(Number(input.numericTolerance) || 0), unit: input.numericUnit });
  }

  const now = new Date().toISOString();
  const becameVerified = input.verificationStatus === "VERIFIED" && existing?.verificationStatus !== "VERIFIED";
  const answerChanged = !existing || existing.answerText !== input.answerText || existing.answerKey !== answerKey;
  const answerSource: AnswerSource = answerChanged ? (input.answerText.trim() || answerKey ? (isDemo ? "AI" : "EDITOR") : "NONE") : existing!.answerSource;
  const values = {
    boardId: ch.boardId,
    classId: ch.classId,
    subjectId: input.subjectId,
    chapterId: input.chapterId,
    topicId: input.topicId ?? null,
    questionText: input.questionText,
    questionType: input.questionType,
    marks: input.marks,
    difficulty: input.difficulty,
    options,
    answerKey,
    answerText: input.answerText,
    explanation: input.explanation,
    sourceType: input.sourceType,
    verificationStatus: input.verificationStatus,
    verificationNotes: input.verificationNotes,
    isPublished: input.isPublished,
    contentHash: await contentHash(input.questionText),
    // An editor saving the form confirms the chapter mapping.
    mappingStatus: "CONFIRMED" as const,
    mappingSource: existing && existing.chapterId === input.chapterId && existing.mappingStatus === "CONFIRMED" ? existing.mappingSource : "editor",
    answerSource,
    updatedAt: now,
    ...(becameVerified ? { verifiedAt: now, verifiedBy: actor } : {}),
    ...(input.verificationStatus !== "VERIFIED" ? { verifiedAt: null, verifiedBy: null } : {}),
  };

  let id: number;
  if (existing) {
    await db.update(questions).set(values).where(eq(questions.id, existing.id));
    id = existing.id;
  } else {
    const [row] = await db.insert(questions).values(values).returning({ id: questions.id });
    id = row.id;
  }
  if (linkPaper) {
    await db
      .insert(questionSources)
      .values({ questionId: id, paperId: linkPaper.id, questionNumber: input.linkQuestionNumber || null, marksInPaper: input.marks, isPrimary: sources.length === 1 })
      .onConflictDoNothing();
  }
  await refreshFrequency(id);
  return { ok: true, id };
}

export async function deleteQuestion(id: number) {
  const db = await getDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(schema.paperQuestions).where(eq(schema.paperQuestions.questionId, id));
  if (Number(n) > 0) {
    // Keep history intact: questions used in generated papers are unpublished rather than removed.
    await db.update(questions).set({ isPublished: false, updatedAt: new Date().toISOString() }).where(eq(questions.id, id));
    return { deleted: false as const, unpublished: true as const };
  }
  await db.delete(questions).where(eq(questions.id, id));
  return { deleted: true as const, unpublished: false as const };
}

/** After a source link is removed, a question that no longer meets the rule loses its verified status. */
async function enforceProvenance(questionIds: number[]) {
  if (!questionIds.length) return;
  const db = await getDb();
  const sources = await getSourcesFor(questionIds);
  for (const part of chunk(questionIds)) {
    const rows = await db.select().from(questions).where(inArray(questions.id, part));
    for (const q of rows) {
      const err = validateProvenance({ sourceType: q.sourceType, verificationStatus: q.verificationStatus, isDemo: q.isDemo, sources: sources.get(q.id) ?? [] });
      if (err) {
        await db
          .update(questions)
          .set({
            verificationStatus: "UNVERIFIED",
            verifiedAt: null,
            verifiedBy: null,
            verificationNotes: `${q.verificationNotes ? `${q.verificationNotes}\n` : ""}Automatically set to unverified: its source paper link was removed.`,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(questions.id, q.id));
      }
      await refreshFrequency(q.id);
    }
  }
}

export async function addSourceLink(questionId: number, paperId: number, questionNumber: string | null, marksInPaper: number | null) {
  const db = await getDb();
  const [[q], [p]] = await Promise.all([
    db.select({ subjectId: questions.subjectId }).from(questions).where(eq(questions.id, questionId)),
    db.select({ subjectId: papers.subjectId }).from(papers).where(eq(papers.id, paperId)),
  ]);
  if (!q || !p) return "That question or paper doesn't exist.";
  if (q.subjectId !== p.subjectId) return "The source paper must be for the same subject as the question.";
  await db.insert(questionSources).values({ questionId, paperId, questionNumber, marksInPaper }).onConflictDoNothing();
  await refreshFrequency(questionId);
  return null;
}

export async function removeSourceLink(questionId: number, paperId: number) {
  const db = await getDb();
  await db.delete(questionSources).where(and(eq(questionSources.questionId, questionId), eq(questionSources.paperId, paperId)));
  await enforceProvenance([questionId]);
}

export async function getQuestionForEdit(id: number) {
  const db = await getDb();
  const [q] = await db.select().from(questions).where(eq(questions.id, id));
  if (!q) return null;
  const sources = (await getSourcesFor([id])).get(id) ?? [];
  const usage = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.paperQuestions)
    .where(eq(schema.paperQuestions.questionId, id));
  return { q, sources, usedInPapers: Number(usage[0].n) };
}

// ───────────────────────────── Source papers ─────────────────────────────

export const paperInputSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive({ message: "Choose a subject." }),
  title: z.string().trim().min(3, "Enter a title, for example “ICSE 2024 Chemistry”.").max(200),
  year: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1950 && v <= new Date().getFullYear()), "Enter a valid year, or leave it blank."),
  paperType: z.enum(PAPER_TYPES),
  sourceUrl: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null)
    .refine((v) => v === null || /^https?:\/\//i.test(v), "Links must start with http:// or https://"),
  sourceNotes: z.string().max(2000).default(""),
  authority: z.enum(SOURCE_AUTHORITIES).default("OTHER"),
  authorityName: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
  examSession: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
  paperName: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
  paperCode: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
  setCode: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
  seriesCode: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
  region: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
  language: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
  sourceFile: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
  answerSourceUrl: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null)
    .refine((v) => v === null || /^https?:\/\//i.test(v), "Links must start with http:// or https://"),
  pageCount: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v < 100000), "Enter a whole number."),
  maxMarks: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v < 100000), "Enter a whole number."),
  durationMinutes: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v < 100000), "Enter a whole number."),
  status: z.enum(SOURCE_STATUSES).default("IMPORTED"),
});
export type PaperInput = z.infer<typeof paperInputSchema>;

export async function listPapers() {
  const db = await getDb();
  return db
    .select({
      paper: papers,
      subject: subjects.name,
      cls: classes.name,
      links: sql<number>`(select count(*) from question_sources qs where qs.paper_id = ${papers.id})`,
    })
    .from(papers)
    .innerJoin(subjects, eq(papers.subjectId, subjects.id))
    .innerJoin(classes, eq(subjects.classId, classes.id))
    .orderBy(asc(papers.isDemo), desc(papers.year), asc(classes.level), asc(papers.title));
}

export async function savePaper(input: PaperInput) {
  const db = await getDb();
  const [s] = await db
    .select({ classId: subjects.classId, boardId: classes.boardId })
    .from(subjects)
    .innerJoin(classes, eq(subjects.classId, classes.id))
    .where(eq(subjects.id, input.subjectId));
  if (!s) return { ok: false as const, error: "That subject doesn't exist." };
  if (input.paperType === "BOARD_EXAM" && input.year === null) {
    // Allowed, but questions linked to it can't become Verified PYQs until a year is added.
  }
  const values = {
    boardId: s.boardId,
    classId: s.classId,
    subjectId: input.subjectId,
    title: input.title,
    year: input.year,
    paperType: input.paperType,
    sourceUrl: input.sourceUrl,
    sourceNotes: input.sourceNotes,
    sourceDomain: domainOf(input.sourceUrl),
    authority: input.authority,
    authorityName: input.authorityName,
    examSession: input.examSession,
    paperName: input.paperName,
    paperCode: input.paperCode,
    setCode: input.setCode,
    seriesCode: input.seriesCode,
    region: input.region,
    language: input.language,
    sourceFile: input.sourceFile,
    answerSourceUrl: input.answerSourceUrl,
    pageCount: input.pageCount,
    maxMarks: input.maxMarks,
    durationMinutes: input.durationMinutes,
    status: input.status,
    updatedAt: new Date().toISOString(),
  };
  if (input.id) {
    const [existing] = await db.select().from(papers).where(eq(papers.id, input.id));
    if (!existing) return { ok: false as const, error: "That paper no longer exists." };
    if (existing.isDemo) return { ok: false as const, error: "Demo papers can't be edited. Delete the demo data instead." };
    await db.update(papers).set(values).where(eq(papers.id, input.id));
    const linked = await db.select({ q: questionSources.questionId }).from(questionSources).where(eq(questionSources.paperId, input.id));
    await enforceProvenance(linked.map((l) => l.q));
    return { ok: true as const, id: input.id };
  }
  const [row] = await db.insert(papers).values(values).returning({ id: papers.id });
  return { ok: true as const, id: row.id };
}

export async function deletePaper(id: number) {
  const db = await getDb();
  const linked = await db.select({ q: questionSources.questionId }).from(questionSources).where(eq(questionSources.paperId, id));
  await db.delete(papers).where(eq(papers.id, id));
  await enforceProvenance(linked.map((l) => l.q));
  return linked.length;
}

// ───────────────────────────── Import ─────────────────────────────

export type ImportInput = {
  subjectId: number;
  paperId: number | null;
  title: string;
  rawText: string;
  extractionMethod: "PDF_TEXT_LAYER" | "OCR" | "PASTED_TEXT";
  /** Mean OCR confidence for the document (0–100), when OCR was used. */
  ocrConfidence: number | null;
  /** OCR confidence per page number, when OCR was used. */
  pageConfidence?: Record<number, number>;
};

export async function createImportBatch(input: ImportInput) {
  const db = await getDb();
  const parsed = parsePaperText(input.rawText, input.pageConfidence);
  if (!parsed.length) return { ok: false as const, error: "No questions were found. Put each question on a new line starting with its number, like “1.” or “Q2)”." };
  if (input.paperId) {
    const [p] = await db.select({ subjectId: papers.subjectId }).from(papers).where(eq(papers.id, input.paperId));
    if (!p || p.subjectId !== input.subjectId) return { ok: false as const, error: "The source paper must be for the chosen subject." };
  }
  const chs = await db.select().from(chapters).where(eq(chapters.subjectId, input.subjectId));
  const tps = await db
    .select({ chapterId: topics.chapterId, name: topics.name })
    .from(topics)
    .innerJoin(chapters, eq(topics.chapterId, chapters.id))
    .where(eq(chapters.subjectId, input.subjectId));
  const chapterKeywords = chs.map((c) => ({
    id: c.id,
    name: c.name,
    keywords: `${c.summary} ${tps
      .filter((t) => t.chapterId === c.id)
      .map((t) => t.name)
      .join(" ")}`,
  }));
  const existing = await db
    .select({ id: questions.id, text: questions.questionText, hash: questions.contentHash })
    .from(questions)
    .where(eq(questions.subjectId, input.subjectId));

  const [batch] = await db
    .insert(importBatches)
    .values({
      subjectId: input.subjectId,
      paperId: input.paperId,
      title: input.title,
      rawText: input.rawText,
      extractionMethod: input.extractionMethod,
      ocrConfidence: input.ocrConfidence,
    })
    .returning({ id: importBatches.id });

  const rows = [];
  for (const item of parsed) {
    const hash = await contentHash(item.text);
    let dup = existing.find((e) => e.hash === hash)?.id ?? null;
    if (!dup) {
      let best = 0;
      for (const e of existing) {
        const s = similarity(item.text, e.text);
        if (s > best && s >= 0.75) {
          best = s;
          dup = e.id;
        }
      }
    }
    rows.push({
      batchId: batch.id,
      position: item.position,
      questionNumber: item.questionNumber,
      section: item.section,
      text: item.text,
      marks: item.marks,
      pageNumber: item.page,
      detectedType: item.type,
      options: item.options ? JSON.stringify(item.options) : null,
      confidence: item.confidence,
      issues: JSON.stringify(item.issues),
      suggestedChapterId: suggestChapter(item.text, chapterKeywords),
      duplicateOfQuestionId: dup,
    });
  }
  // 13 values per row: 7 rows per insert keeps under D1's parameter limit.
  for (let i = 0; i < rows.length; i += 7) await db.insert(importItems).values(rows.slice(i, i + 7));
  if (input.paperId) {
    await db
      .update(papers)
      .set({
        status: "EXTRACTED",
        extractionMethod: input.extractionMethod,
        ocrUsed: input.extractionMethod === "OCR",
        ocrConfidence: input.ocrConfidence,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(papers.id, input.paperId), inArray(papers.status, ["DISCOVERED", "IMPORTED"])));
  }
  return { ok: true as const, id: batch.id, count: rows.length };
}

export async function listImportBatches() {
  const db = await getDb();
  return db
    .select({
      batch: importBatches,
      subject: subjects.name,
      cls: classes.name,
      pending: sql<number>`(select count(*) from import_items i where i.batch_id = ${importBatches.id} and i.status = 'PENDING')`,
      total: sql<number>`(select count(*) from import_items i where i.batch_id = ${importBatches.id})`,
    })
    .from(importBatches)
    .innerJoin(subjects, eq(importBatches.subjectId, subjects.id))
    .innerJoin(classes, eq(subjects.classId, classes.id))
    .orderBy(desc(importBatches.createdAt));
}

export async function getImportBatch(id: number) {
  const db = await getDb();
  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, id));
  if (!batch) return null;
  const items = await db.select().from(importItems).where(eq(importItems.batchId, id)).orderBy(asc(importItems.position));
  const [paper] = batch.paperId ? await db.select().from(papers).where(eq(papers.id, batch.paperId)) : [];
  const dupIds = items.map((i) => i.duplicateOfQuestionId).filter((x): x is number => x !== null);
  const dups = dupIds.length ? await db.select({ id: questions.id, text: questions.questionText }).from(questions).where(inArray(questions.id, dupIds)) : [];
  return { batch, items, paper: paper ?? null, duplicates: new Map(dups.map((d) => [d.id, d.text])) };
}

export async function rejectImportItem(itemId: number) {
  const db = await getDb();
  await db.update(importItems).set({ status: "REJECTED", updatedAt: new Date().toISOString() }).where(eq(importItems.id, itemId));
}

export async function markItemApproved(itemId: number, questionId: number) {
  const db = await getDb();
  await db.update(importItems).set({ status: "APPROVED", questionId, updatedAt: new Date().toISOString() }).where(eq(importItems.id, itemId));
  const [item] = await db.select({ batchId: importItems.batchId }).from(importItems).where(eq(importItems.id, itemId));
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(importItems)
    .where(and(eq(importItems.batchId, item.batchId), eq(importItems.status, "PENDING")));
  if (Number(n) === 0) await db.update(importBatches).set({ status: "COMPLETED" }).where(eq(importBatches.id, item.batchId));
}

// ───────────────────────────── Demo data ─────────────────────────────

/** Removes every demo question and demo paper, plus generated papers and attempts that used them. */
export async function purgeDemoData() {
  const db = await getDb();
  const demoPapers = await db.select({ id: generatedPapers.id }).from(generatedPapers).where(eq(generatedPapers.hasDemo, true));
  for (const part of chunk(demoPapers.map((p) => p.id))) await db.delete(generatedPapers).where(inArray(generatedPapers.id, part));
  await db.delete(questions).where(eq(questions.isDemo, true));
  await db.delete(papers).where(eq(papers.isDemo, true));
  return demoPapers.length;
}

function domainOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// ───────────────────────────── Review queue ─────────────────────────────

/** Source documents with their extraction/review progress. */
export async function listSourcesWithProgress() {
  const db = await getDb();
  return db
    .select({
      paper: papers,
      subject: subjects.name,
      cls: classes.name,
      board: schema.boards.name,
      extracted: sql<number>`(SELECT COUNT(*) FROM question_sources qs WHERE qs.paper_id = ${papers.id})`,
      pending: sql<number>`(SELECT COUNT(*) FROM question_sources qs JOIN questions q ON q.id = qs.question_id WHERE qs.paper_id = ${papers.id} AND q.verification_status = 'UNVERIFIED')`,
      verified: sql<number>`(SELECT COUNT(*) FROM question_sources qs JOIN questions q ON q.id = qs.question_id WHERE qs.paper_id = ${papers.id} AND q.verification_status = 'VERIFIED')`,
      published: sql<number>`(SELECT COUNT(*) FROM question_sources qs JOIN questions q ON q.id = qs.question_id WHERE qs.paper_id = ${papers.id} AND q.verification_status = 'VERIFIED' AND q.is_published = 1)`,
      rejected: sql<number>`(SELECT COUNT(*) FROM question_sources qs JOIN questions q ON q.id = qs.question_id WHERE qs.paper_id = ${papers.id} AND q.verification_status = 'REJECTED')`,
      flagged: sql<number>`(SELECT COUNT(*) FROM question_sources qs JOIN questions q ON q.id = qs.question_id WHERE qs.paper_id = ${papers.id} AND (q.has_figure = 1 OR q.extraction_confidence = 'LOW'))`,
    })
    .from(papers)
    .innerJoin(subjects, eq(papers.subjectId, subjects.id))
    .innerJoin(classes, eq(subjects.classId, classes.id))
    .innerJoin(schema.boards, eq(classes.boardId, schema.boards.id))
    .where(eq(papers.isDemo, false))
    .orderBy(desc(papers.year), asc(papers.title));
}

export type VerifyOutcome = { verified: number; published: number; failed: { id: number; reason: string }[] };

/**
 * Marks questions as verified after an editor has checked them against their source.
 * The provenance rule is applied to every question; anything that fails stays pending.
 */
export async function verifyQuestions(ids: number[], actor: string, opts: { publish: boolean; confirmMapping: boolean }): Promise<VerifyOutcome> {
  const db = await getDb();
  const out: VerifyOutcome = { verified: 0, published: 0, failed: [] };
  const unique = [...new Set(ids)].slice(0, 200);
  const sources = await getSourcesFor(unique);
  const now = new Date().toISOString();
  for (const part of chunk(unique)) {
    const rows = await db.select().from(questions).where(inArray(questions.id, part));
    for (const q of rows) {
      if (q.verificationStatus === "REJECTED") {
        out.failed.push({ id: q.id, reason: "Rejected questions must be reopened from the edit page first." });
        continue;
      }
      const err = validateProvenance(
        { sourceType: q.sourceType, verificationStatus: "VERIFIED", isDemo: q.isDemo, sources: sources.get(q.id) ?? [] },
        { sourceType: q.sourceType },
      );
      if (err || q.isDemo) {
        out.failed.push({ id: q.id, reason: err ?? "Demo questions can't be verified." });
        continue;
      }
      await db
        .update(questions)
        .set({
          verificationStatus: "VERIFIED",
          verifiedAt: q.verificationStatus === "VERIFIED" ? q.verifiedAt : now,
          verifiedBy: q.verificationStatus === "VERIFIED" ? q.verifiedBy : actor,
          verificationNotes: `${q.verificationNotes.replace(/\s*Awaiting editor verification against the official PDF\.?/, "")} Verified by ${actor} on ${now.slice(0, 10)}.`.trim(),
          ...(opts.publish ? { isPublished: true } : {}),
          ...(opts.confirmMapping ? { mappingStatus: "CONFIRMED" as const, mappingSource: "editor" } : {}),
          updatedAt: now,
        })
        .where(eq(questions.id, q.id));
      out.verified++;
      if (opts.publish) out.published++;
    }
  }
  await refreshSourceStatuses();
  return out;
}

export async function rejectQuestions(ids: number[], reason: string) {
  const db = await getDb();
  for (const part of chunk([...new Set(ids)])) {
    await db
      .update(questions)
      .set({ verificationStatus: "REJECTED", isPublished: false, verifiedAt: null, verifiedBy: null, verificationNotes: reason.slice(0, 500), updatedAt: new Date().toISOString() })
      .where(and(inArray(questions.id, part), eq(questions.isDemo, false)));
  }
  await refreshSourceStatuses();
}

/** Keeps each source document's status in step with the review state of its questions. */
export async function refreshSourceStatuses() {
  const db = await getDb();
  await db.run(sql`UPDATE papers SET status = CASE
      WHEN (SELECT COUNT(*) FROM question_sources qs WHERE qs.paper_id = papers.id) = 0 THEN status
      WHEN (SELECT COUNT(*) FROM question_sources qs JOIN questions q ON q.id = qs.question_id WHERE qs.paper_id = papers.id AND q.verification_status = 'UNVERIFIED') > 0 THEN 'PENDING_REVIEW'
      WHEN (SELECT COUNT(*) FROM question_sources qs JOIN questions q ON q.id = qs.question_id WHERE qs.paper_id = papers.id AND q.verification_status = 'VERIFIED' AND q.is_published = 1) > 0 THEN 'PUBLISHED'
      WHEN (SELECT COUNT(*) FROM question_sources qs JOIN questions q ON q.id = qs.question_id WHERE qs.paper_id = papers.id AND q.verification_status = 'VERIFIED') > 0 THEN 'VERIFIED'
      ELSE 'REJECTED' END
    WHERE is_demo = 0 AND status NOT IN ('DISCOVERED')`);
}

// ───────────────────────────── Duplicates ─────────────────────────────

export async function listDuplicateGroups() {
  const db = await getDb();
  const members = await db
    .select({
      id: questions.id,
      canonical: questions.canonicalQuestionId,
      text: questions.questionText,
      status: questions.verificationStatus,
      marks: questions.marks,
    })
    .from(questions)
    .where(sql`${questions.canonicalQuestionId} IS NOT NULL OR ${questions.id} IN (SELECT canonical_question_id FROM questions WHERE canonical_question_id IS NOT NULL)`)
    .orderBy(asc(questions.id));
  const sources = await getSourcesFor(members.map((m) => m.id));
  const groups = new Map<number, { canonicalId: number; members: (typeof members[number] & { sources: SourceLink[] })[] }>();
  for (const m of members) {
    const gid = m.canonical ?? m.id;
    const g = groups.get(gid) ?? { canonicalId: gid, members: [] };
    g.members.push({ ...m, sources: sources.get(m.id) ?? [] });
    groups.set(gid, g);
  }
  return [...groups.values()].filter((g) => g.members.length > 1);
}

/** Merge a question into a canonical group, or split it out (canonicalId = null). */
export async function setCanonical(questionId: number, canonicalId: number | null) {
  const db = await getDb();
  if (canonicalId === questionId) canonicalId = null;
  if (canonicalId !== null) {
    const [c] = await db.select({ id: questions.id, canonical: questions.canonicalQuestionId, subjectId: questions.subjectId }).from(questions).where(eq(questions.id, canonicalId));
    const [q] = await db.select({ subjectId: questions.subjectId }).from(questions).where(eq(questions.id, questionId));
    if (!c || !q) return "That question doesn't exist.";
    if (c.subjectId !== q.subjectId) return "Duplicates must be in the same subject.";
    canonicalId = c.canonical ?? c.id; // always point at the group root
  }
  await db.update(questions).set({ canonicalQuestionId: canonicalId, updatedAt: new Date().toISOString() }).where(eq(questions.id, questionId));
  // Children of a question that is merged elsewhere follow it.
  if (canonicalId !== null) await db.update(questions).set({ canonicalQuestionId: canonicalId }).where(eq(questions.canonicalQuestionId, questionId));
  return null;
}

// ───────────────────────────── Analytics ─────────────────────────────

/** Factual counts for the admin dashboard. Every number is a live COUNT over stored rows. */
export async function getAnalytics() {
  const db = await getDb();
  const count = async (where: ReturnType<typeof sql>) => Number((await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM ${where}`))[0]?.n ?? 0);
  const [bySourceStatus, byBoardClass, byYear, sourcesByStatus] = await Promise.all([
    db.all<{ source_type: string; verification_status: string; is_demo: number; n: number }>(
      sql`SELECT source_type, verification_status, is_demo, COUNT(*) AS n FROM questions GROUP BY 1, 2, 3`,
    ),
    db.all<{ board: string; level: number; cls: string; subject: string; subject_id: number; total: number; real_pyq: number; pending: number; ai: number }>(
      sql`SELECT b.name AS board, c.level AS level, c.name AS cls, s.name AS subject, s.id AS subject_id,
            COUNT(q.id) AS total,
            SUM(CASE WHEN q.id IS NOT NULL AND q.is_demo = 0 AND q.source_type = 'VERIFIED_PYQ' AND q.verification_status = 'VERIFIED' THEN 1 ELSE 0 END) AS real_pyq,
            SUM(CASE WHEN q.id IS NOT NULL AND q.is_demo = 0 AND q.verification_status = 'UNVERIFIED' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN q.source_type = 'AI_SUPPLEMENTARY' THEN 1 ELSE 0 END) AS ai
          FROM subjects s JOIN classes c ON c.id = s.class_id JOIN boards b ON b.id = c.board_id LEFT JOIN questions q ON q.subject_id = s.id
          GROUP BY s.id ORDER BY b.sort_order, c.level, s.sort_order`,
    ),
    db.all<{ year: number; board: string; verified: number; pending: number }>(
      sql`SELECT p.year AS year, b.name AS board,
            COUNT(DISTINCT CASE WHEN q.verification_status = 'VERIFIED' THEN COALESCE(q.canonical_question_id, q.id) END) AS verified,
            COUNT(DISTINCT CASE WHEN q.verification_status = 'UNVERIFIED' THEN COALESCE(q.canonical_question_id, q.id) END) AS pending
          FROM question_sources qs JOIN papers p ON p.id = qs.paper_id JOIN questions q ON q.id = qs.question_id JOIN boards b ON b.id = p.board_id
          WHERE p.is_demo = 0 AND p.paper_type = 'BOARD_EXAM' AND p.year IS NOT NULL
          GROUP BY p.year, b.name ORDER BY p.year DESC`,
    ),
    db.all<{ status: string; n: number }>(sql`SELECT status, COUNT(*) AS n FROM papers WHERE is_demo = 0 GROUP BY status`),
  ]);
  const [duplicateGroups, lowConfidence, figures, suggestedMappings, pendingImports] = await Promise.all([
    count(sql`(SELECT DISTINCT canonical_question_id FROM questions WHERE canonical_question_id IS NOT NULL)`),
    count(sql`questions WHERE extraction_confidence = 'LOW' AND verification_status <> 'REJECTED'`),
    count(sql`questions WHERE has_figure = 1 AND verification_status <> 'REJECTED'`),
    count(sql`questions WHERE mapping_status = 'SUGGESTED' AND verification_status <> 'REJECTED'`),
    count(sql`import_items WHERE status = 'PENDING'`),
  ]);
  const n = (rows: { n: number }[]) => rows.reduce((t, r) => t + Number(r.n), 0);
  return {
    provenance: bySourceStatus.map((r) => ({ sourceType: r.source_type, status: r.verification_status, isDemo: Boolean(r.is_demo), n: Number(r.n) })),
    totals: {
      questions: n(bySourceStatus),
      realVerifiedPyq: bySourceStatus.filter((r) => !r.is_demo && r.source_type === "VERIFIED_PYQ" && r.verification_status === "VERIFIED").reduce((t, r) => t + Number(r.n), 0),
      pendingReview: bySourceStatus.filter((r) => !r.is_demo && r.verification_status === "UNVERIFIED").reduce((t, r) => t + Number(r.n), 0),
      rejected: bySourceStatus.filter((r) => r.verification_status === "REJECTED").reduce((t, r) => t + Number(r.n), 0),
      ai: bySourceStatus.filter((r) => r.source_type === "AI_SUPPLEMENTARY").reduce((t, r) => t + Number(r.n), 0),
      sources: n(sourcesByStatus),
      duplicateGroups,
      lowConfidence,
      figures,
      suggestedMappings,
      pendingImports,
    },
    sourcesByStatus: sourcesByStatus.map((r) => ({ status: r.status, n: Number(r.n) })),
    bySubject: byBoardClass.map((r) => ({ ...r, total: Number(r.total), real_pyq: Number(r.real_pyq ?? 0), pending: Number(r.pending ?? 0), ai: Number(r.ai ?? 0) })),
    byYear: byYear.map((r) => ({ ...r, verified: Number(r.verified), pending: Number(r.pending) })),
  };
}
