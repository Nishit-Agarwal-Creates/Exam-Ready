/**
 * ExamReady relational schema (SQLite / Cloudflare D1).
 *
 * Taxonomy:   boards → classes → subjects → chapters → topics
 * Provenance: questions ←→ question_sources ←→ papers (historical/official source documents)
 * Practice:   generated_papers → paper_questions → questions
 * Attempts:   attempts → attempt_answers
 * Ingestion:  import_batches → import_items (staged, admin-reviewed before publishing)
 *
 * Provenance rule: a question is only presented as a verified PYQ when source_type is VERIFIED_PYQ,
 * verification_status is VERIFIED, it is not demo data, and it is linked (question_sources) to a
 * board-exam paper that has a year. Extraction and AI suggestions never set VERIFIED; only an editor
 * does. The rule is enforced in src/lib/provenance.ts and by every write path in the admin.
 *
 * Duplicates: questions that are the same question (e.g. repeated across sets or years) point to one
 * canonical question via canonical_question_id. Frequency and trends count distinct papers/years per
 * canonical group, so duplicates never inflate statistics.
 */
import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
};

/**
 * VERIFIED_PYQ      — claimed to come from a board exam paper. Shown as a verified PYQ only after review.
 * OFFICIAL_SAMPLE   — official specimen/sample/practice material.
 * USER_CONTRIBUTED  — added by a contributor; not claimed to be from a past paper.
 * AI_SUPPLEMENTARY  — written by AI (including the demo bank). Never a PYQ.
 * PENDING_REVIEW    — origin not yet established; waiting for an editor.
 */
export const SOURCE_TYPES = ["VERIFIED_PYQ", "OFFICIAL_SAMPLE", "USER_CONTRIBUTED", "AI_SUPPLEMENTARY", "PENDING_REVIEW"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const VERIFICATION_STATUSES = ["VERIFIED", "UNVERIFIED", "REJECTED"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const QUESTION_TYPES = ["MCQ", "ASSERTION_REASON", "FILL_BLANK", "NUMERICAL", "SHORT_ANSWER", "LONG_ANSWER", "CASE_BASED"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
/** Stored difficulty. Board exam questions are UNRATED: the paper doesn't state a difficulty and we don't invent one. */
export const STORED_DIFFICULTIES = [...DIFFICULTIES, "UNRATED"] as const;

export const PAPER_TYPES = ["BOARD_EXAM", "SPECIMEN", "SAMPLE", "SCHOOL_EXAM", "OTHER"] as const;
export type PaperType = (typeof PAPER_TYPES)[number];

export const PAPER_MODES = [
  "PYQ_ONLY",
  "PYQ_PRIORITY",
  "EXAM_SIMULATION",
  "RECENT_PYQ",
  "MOST_REPEATED",
  "PYQ_PLUS_OFFICIAL",
  "PRACTICE",
  "AI_SUPPLEMENTARY",
] as const;
export type PaperMode = (typeof PAPER_MODES)[number];

export const SOURCE_AUTHORITIES = ["OFFICIAL_BOARD", "OFFICIAL_INSTITUTION", "REPOSITORY", "USER_UPLOAD", "OTHER"] as const;
export type SourceAuthority = (typeof SOURCE_AUTHORITIES)[number];

/** Life cycle of a source document. Extraction is not verification. */
export const SOURCE_STATUSES = ["DISCOVERED", "IMPORTED", "EXTRACTED", "PENDING_REVIEW", "VERIFIED", "PUBLISHED", "REJECTED"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const EXTRACTION_METHODS = ["PDF_TEXT_LAYER", "OCR", "PASTED_TEXT", "MANUAL"] as const;
export type ExtractionMethod = (typeof EXTRACTION_METHODS)[number];

export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

/** Where a chapter/topic mapping came from. Only CONFIRMED mappings are treated as fact. */
export const MAPPING_STATUSES = ["CONFIRMED", "SUGGESTED"] as const;
export type MappingStatus = (typeof MAPPING_STATUSES)[number];

/** Where the stored answer came from. */
export const ANSWER_SOURCES = ["OFFICIAL_SCHEME", "EDITOR", "AI", "NONE"] as const;
export type AnswerSource = (typeof ANSWER_SOURCES)[number];

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
    /** Stable key for imported source packs (src/data/sources/*.json). */
    sourceKey: text("source_key"),
    authority: text("authority", { enum: SOURCE_AUTHORITIES }).notNull().default("OTHER"),
    authorityName: text("authority_name"),
    sourceDomain: text("source_domain"),
    /** Path of the document inside an archive at source_url, when applicable. */
    sourceFile: text("source_file"),
    answerSourceUrl: text("answer_source_url"),
    answerSourceFile: text("answer_source_file"),
    examSession: text("exam_session"),
    paperName: text("paper_name"),
    paperCode: text("paper_code"),
    setCode: text("set_code"),
    seriesCode: text("series_code"),
    region: text("region"),
    language: text("language"),
    fileType: text("file_type"),
    pageCount: integer("page_count"),
    sha256: text("sha256"),
    maxMarks: integer("max_marks"),
    durationMinutes: integer("duration_minutes"),
    extractionMethod: text("extraction_method", { enum: EXTRACTION_METHODS }),
    extractionTool: text("extraction_tool"),
    ocrUsed: integer("ocr_used", { mode: "boolean" }).notNull().default(false),
    ocrConfidence: real("ocr_confidence"),
    status: text("status", { enum: SOURCE_STATUSES }).notNull().default("IMPORTED"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: text("reviewed_at"),
    ...timestamps,
  },
  (t) => [index("papers_subject").on(t.subjectId, t.year), uniqueIndex("papers_source_key").on(t.sourceKey)],
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
    difficulty: text("difficulty", { enum: STORED_DIFFICULTIES }).notNull().default("MEDIUM"),
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
    /** Points to the canonical question when this one is a duplicate (null = canonical itself). */
    canonicalQuestionId: integer("canonical_question_id"),
    mappingStatus: text("mapping_status", { enum: MAPPING_STATUSES }).notNull().default("CONFIRMED"),
    /** e.g. "author", "keyword", "ai", "editor" */
    mappingSource: text("mapping_source").notNull().default("author"),
    answerSource: text("answer_source", { enum: ANSWER_SOURCES }).notNull().default("NONE"),
    hasFigure: integer("has_figure", { mode: "boolean" }).notNull().default(false),
    extractionConfidence: text("extraction_confidence", { enum: CONFIDENCE_LEVELS }),
    /** JSON array of strings describing what extraction may have lost. */
    extractionIssues: text("extraction_issues").notNull().default("[]"),
    ...timestamps,
  },
  (t) => [
    index("questions_subject_chapter").on(t.subjectId, t.chapterId),
    index("questions_source").on(t.sourceType, t.verificationStatus),
    index("questions_hash").on(t.contentHash),
    index("questions_canonical").on(t.canonicalQuestionId),
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
    /** Sub-part or internal-choice label as printed, e.g. "(a)". */
    part: text("part"),
    pageNumber: integer("page_number"),
    section: text("section"),
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
  extractionMethod: text("extraction_method", { enum: EXTRACTION_METHODS }).notNull().default("PASTED_TEXT"),
  ocrConfidence: real("ocr_confidence"),
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
    pageNumber: integer("page_number"),
    detectedType: text("detected_type"),
    /** JSON array of MCQ options detected in the text. */
    options: text("options"),
    confidence: text("confidence", { enum: CONFIDENCE_LEVELS }),
    /** JSON array of strings explaining low confidence. */
    issues: text("issues").notNull().default("[]"),
    suggestedChapterId: integer("suggested_chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    duplicateOfQuestionId: integer("duplicate_of_question_id").references(() => questions.id, { onDelete: "set null" }),
    status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED"] }).notNull().default("PENDING"),
    questionId: integer("question_id").references(() => questions.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("import_items_batch").on(t.batchId)],
);
