/**
 * ExamReady relational schema (SQLite / Cloudflare D1).
 *
 * Taxonomy:   boards → classes → subjects → chapters → topics
 * Provenance: questions ←→ question_sources ←→ papers (historical/official source documents)
 * Practice:   generated_papers → paper_questions → questions
 * Attempts:   attempts → attempt_answers
 * Ingestion:  import_batches → import_items (staged, admin-reviewed before publishing)
 *
 * Provenance rule: a question may only carry source_type VERIFIED_PYQ with verification_status
 * VERIFIED when it is linked (question_sources) to a board-exam paper that has a year. The rule is
 * enforced in src/lib/provenance.ts and by every write path in the admin.
 */
import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
};

export const SOURCE_TYPES = ["VERIFIED_PYQ", "OFFICIAL_SAMPLE", "USER_CONTRIBUTED", "AI_SUPPLEMENTARY"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const VERIFICATION_STATUSES = ["VERIFIED", "UNVERIFIED", "REJECTED"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const QUESTION_TYPES = ["MCQ", "FILL_BLANK", "NUMERICAL", "SHORT_ANSWER", "LONG_ANSWER"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const PAPER_TYPES = ["BOARD_EXAM", "SPECIMEN", "SAMPLE", "SCHOOL_EXAM", "OTHER"] as const;
export type PaperType = (typeof PAPER_TYPES)[number];

export const PAPER_MODES = ["PYQ_ONLY", "PYQ_PRIORITY", "EXAM_SIMULATION"] as const;
export type PaperMode = (typeof PAPER_MODES)[number];

export const USER_ROLES = ["STUDENT", "TEACHER", "PARENT", "ADMIN"] as const;
export const PLANS = ["FREE", "PRO", "INSTITUTE"] as const;

// ───────────────────────────── Taxonomy ─────────────────────────────

export const boards = sqliteTable("boards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull(),
  description: text("description").notNull().default(""),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

export const classes = sqliteTable(
  "classes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    boardId: integer("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
    level: integer("level").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("classes_board_slug").on(t.boardId, t.slug)],
);

export const subjects = sqliteTable(
  "subjects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    classId: integer("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    overview: text("overview").notNull().default(""),
    /** JSON array of strings */
    studyTips: text("study_tips").notNull().default("[]"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("subjects_class_slug").on(t.classId, t.slug)],
);

export const chapters = sqliteTable(
  "chapters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subjectId: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    summary: text("summary").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("chapters_subject_slug").on(t.subjectId, t.slug)],
);

export const topics = sqliteTable(
  "topics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chapterId: integer("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("topics_chapter_slug").on(t.chapterId, t.slug)],
);

// ───────────────────────────── Source papers ─────────────────────────────

/** A historical or official source document (board exam paper, specimen paper, sample paper). */
export const papers = sqliteTable(
  "papers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    boardId: integer("board_id").notNull().references(() => boards.id),
    classId: integer("class_id").notNull().references(() => classes.id),
    subjectId: integer("subject_id").notNull().references(() => subjects.id),
    title: text("title").notNull(),
    year: integer("year"),
    paperType: text("paper_type", { enum: PAPER_TYPES }).notNull(),
    sourceUrl: text("source_url"),
    sourceNotes: text("source_notes").notNull().default(""),
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [index("papers_subject").on(t.subjectId, t.year)],
);

// ───────────────────────────── Questions ─────────────────────────────

export const questions = sqliteTable(
  "questions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Stable external key for seeds/imports (e.g. "icse-9-chemistry-001"). */
    externalKey: text("external_key").unique(),
    boardId: integer("board_id").notNull().references(() => boards.id),
    classId: integer("class_id").notNull().references(() => classes.id),
    subjectId: integer("subject_id").notNull().references(() => subjects.id),
    chapterId: integer("chapter_id").notNull().references(() => chapters.id),
    topicId: integer("topic_id").references(() => topics.id, { onDelete: "set null" }),
    questionText: text("question_text").notNull(),
    questionType: text("question_type", { enum: QUESTION_TYPES }).notNull(),
    marks: integer("marks").notNull(),
    difficulty: text("difficulty", { enum: DIFFICULTIES }).notNull().default("MEDIUM"),
    /** JSON array of option strings (MCQ only). */
    options: text("options"),
    /** JSON answer key used for auto-evaluation: {correctOption} | {accepted[]} | {value,tolerance,unit}. */
    answerKey: text("answer_key"),
    answerText: text("answer_text").notNull().default(""),
    explanation: text("explanation").notNull().default(""),
    sourceType: text("source_type", { enum: SOURCE_TYPES }).notNull(),
    verificationStatus: text("verification_status", { enum: VERIFICATION_STATUSES }).notNull().default("UNVERIFIED"),
    verificationNotes: text("verification_notes").notNull().default(""),
    verifiedAt: text("verified_at"),
    verifiedBy: text("verified_by"),
    isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
    /** Demo/fictional content. Always rendered with a DEMO DATA label, never as a real PYQ. */
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    /** Cached count of distinct linked board-exam papers. Recomputed from question_sources. */
    frequencyCount: integer("frequency_count").notNull().default(0),
    /** Normalised text hash used for duplicate detection. */
    contentHash: text("content_hash").notNull().default(""),
    ...timestamps,
  },
  (t) => [
    index("questions_subject_chapter").on(t.subjectId, t.chapterId),
    index("questions_source").on(t.sourceType, t.verificationStatus),
    index("questions_hash").on(t.contentHash),
  ],
);

/** Links a question to each source paper it appeared in (one row per appearance). */
export const questionSources = sqliteTable(
  "question_sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    questionId: integer("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
    paperId: integer("paper_id").notNull().references(() => papers.id, { onDelete: "cascade" }),
    questionNumber: text("question_number"),
    marksInPaper: integer("marks_in_paper"),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    notes: text("notes").notNull().default(""),
    ...timestamps,
  },
  (t) => [uniqueIndex("question_sources_unique").on(t.questionId, t.paperId), index("question_sources_paper").on(t.paperId)],
);

// ───────────────────────────── Users (foundation for accounts/plans) ─────────────────────────────

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  role: text("role", { enum: USER_ROLES }).notNull().default("STUDENT"),
  plan: text("plan", { enum: PLANS }).notNull().default("FREE"),
  ...timestamps,
});

// ───────────────────────────── Generated practice papers ─────────────────────────────

export const generatedPapers = sqliteTable(
  "generated_papers",
  {
    id: text("id").primaryKey(),
    boardId: integer("board_id").notNull().references(() => boards.id),
    classId: integer("class_id").notNull().references(() => classes.id),
    subjectId: integer("subject_id").notNull().references(() => subjects.id),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    mode: text("mode", { enum: PAPER_MODES }).notNull(),
    totalMarks: integer("total_marks").notNull(),
    requestedMarks: integer("requested_marks").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    difficulty: text("difficulty").notNull().default("MIXED"),
    /** JSON array of chapter ids; empty = whole syllabus */
    chapterIds: text("chapter_ids").notNull().default("[]"),
    /** JSON {VERIFIED_PYQ: marks, ...} computed at generation time */
    composition: text("composition").notNull().default("{}"),
    /** JSON array of notices shown with the paper */
    notices: text("notices").notNull().default("[]"),
    hasDemo: integer("has_demo", { mode: "boolean" }).notNull().default(false),
    seed: integer("seed").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("generated_papers_subject").on(t.subjectId)],
);

export const paperQuestions = sqliteTable(
  "paper_questions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    generatedPaperId: text("generated_paper_id").notNull().references(() => generatedPapers.id, { onDelete: "cascade" }),
    questionId: integer("question_id").notNull().references(() => questions.id),
    position: integer("position").notNull(),
    section: text("section").notNull().default("A"),
    marks: integer("marks").notNull(),
  },
  (t) => [uniqueIndex("paper_questions_position").on(t.generatedPaperId, t.position)],
);

// ───────────────────────────── Attempts ─────────────────────────────

export const attempts = sqliteTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    generatedPaperId: text("generated_paper_id").notNull().references(() => generatedPapers.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    startedAt: text("started_at").notNull(),
    submittedAt: text("submitted_at"),
    timeUsedSeconds: integer("time_used_seconds").notNull().default(0),
    status: text("status", { enum: ["IN_PROGRESS", "SUBMITTED"] }).notNull().default("SUBMITTED"),
    maxScore: integer("max_score").notNull().default(0),
    /** Marks from automatically evaluated questions */
    autoScore: real("auto_score"),
    /** Marks the student awarded themselves on descriptive questions (null until reviewed) */
    selfScore: real("self_score"),
    ...timestamps,
  },
  (t) => [index("attempts_paper").on(t.generatedPaperId)],
);

export const attemptAnswers = sqliteTable(
  "attempt_answers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    attemptId: text("attempt_id").notNull().references(() => attempts.id, { onDelete: "cascade" }),
    questionId: integer("question_id").notNull().references(() => questions.id),
    position: integer("position").notNull(),
    response: text("response"),
    /** null = not auto-evaluable (descriptive) */
    isCorrect: integer("is_correct", { mode: "boolean" }),
    marksAwarded: real("marks_awarded"),
    evaluationMethod: text("evaluation_method", { enum: ["AUTO", "SELF", "AI", "TEACHER", "NONE"] })
      .notNull()
      .default("NONE"),
    markedForReview: integer("marked_for_review", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [uniqueIndex("attempt_answers_unique").on(t.attemptId, t.questionId)],
);

// ───────────────────────────── Ingestion ─────────────────────────────

export const importBatches = sqliteTable("import_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  /** Source paper the admin says this text came from (optional; provenance is never inferred). */
  paperId: integer("paper_id").references(() => papers.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  rawText: text("raw_text").notNull(),
  status: text("status", { enum: ["IN_REVIEW", "COMPLETED"] }).notNull().default("IN_REVIEW"),
  ...timestamps,
});

export const importItems = sqliteTable(
  "import_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    batchId: integer("batch_id").notNull().references(() => importBatches.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    questionNumber: text("question_number"),
    section: text("section"),
    text: text("text").notNull(),
    marks: integer("marks"),
    suggestedChapterId: integer("suggested_chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    duplicateOfQuestionId: integer("duplicate_of_question_id").references(() => questions.id, { onDelete: "set null" }),
    status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED"] }).notNull().default("PENDING"),
    questionId: integer("question_id").references(() => questions.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("import_items_batch").on(t.batchId)],
);
