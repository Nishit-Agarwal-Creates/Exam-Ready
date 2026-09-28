import type { PaperType, SourceAuthority, SourceType, VerificationStatus } from "@/db/schema";

/**
 * Label for the AI-written practice bank (stored with is_demo = 1). It is truthful practice content:
 * written by AI, never from an exam, never counted as a PYQ. Kept under the old export name so every
 * surface that used the demo label now says what the content actually is.
 */
export const DEMO_LABEL = "AI practice: written by AI, not from any exam";

/**
 * Category definitions. `badge` is the short student-facing stamp; each category has its own
 * colour and shape in the UI so AI practice can never be mistaken for a verified PYQ.
 */
export const SOURCE_LABELS: Record<SourceType, { badge: string; short: string; long: string; description: string }> = {
  VERIFIED_PYQ: {
    badge: "Verified PYQ",
    short: "Verified PYQ",
    long: "Verified previous-year question",
    description: "Appeared in the listed board exam paper and was checked against the official document by an editor.",
  },
  OFFICIAL_SAMPLE: {
    badge: "Official sample",
    short: "Official sample",
    long: "Official sample or specimen question",
    description: "From official sample, specimen or practice material. It did not necessarily appear in a board exam.",
  },
  USER_CONTRIBUTED: {
    badge: "Community",
    short: "Community",
    long: "Community-contributed question",
    description: "Added by a contributor. It is not claimed to be from a past paper.",
  },
  AI_SUPPLEMENTARY: {
    badge: "AI practice",
    short: "AI practice",
    long: "AI-generated practice question",
    description: "Written by AI for extra practice. It has never appeared in an exam and is never counted as a PYQ.",
  },
  PENDING_REVIEW: {
    badge: "Pending review",
    short: "Pending review",
    long: "Question awaiting source review",
    description: "Its origin hasn't been established yet. An editor needs to review it.",
  },
};

/** Composition labels for questions from the AI practice bank, so they never read as a real category. */
export const DEMO_SOURCE_LABELS: Record<SourceType, string> = {
  VERIFIED_PYQ: "AI practice",
  OFFICIAL_SAMPLE: "AI practice",
  USER_CONTRIBUTED: "AI practice",
  AI_SUPPLEMENTARY: "AI practice",
  PENDING_REVIEW: "AI practice",
};

export const STATUS_LABELS: Record<VerificationStatus, string> = {
  VERIFIED: "Verified",
  UNVERIFIED: "Pending review",
  REJECTED: "Rejected",
};

export const PAPER_TYPE_LABELS: Record<PaperType, string> = {
  BOARD_EXAM: "Board exam paper",
  SPECIMEN: "Specimen paper",
  SAMPLE: "Sample paper",
  SCHOOL_EXAM: "School exam paper",
  OTHER: "Other source",
};

export const AUTHORITY_LABELS: Record<SourceAuthority, string> = {
  OFFICIAL_BOARD: "Official board source",
  OFFICIAL_INSTITUTION: "Official institution source",
  REPOSITORY: "Educational repository",
  USER_UPLOAD: "Uploaded by a user",
  OTHER: "Other source",
};

export type SourceLink = {
  paperId: number;
  title: string;
  year: number | null;
  paperType: PaperType;
  sourceUrl: string | null;
  questionNumber: string | null;
  isDemo: boolean;
  part?: string | null;
  pageNumber?: number | null;
  paperCode?: string | null;
  setCode?: string | null;
  authority?: SourceAuthority;
  authorityName?: string | null;
  sourceFile?: string | null;
  boardName?: string | null;
};

export type ProvenanceInput = {
  sourceType: SourceType;
  verificationStatus: VerificationStatus;
  isDemo: boolean;
  sources: SourceLink[];
};

const isBoardPaperWithYear = (s: SourceLink) => !s.isDemo && s.paperType === "BOARD_EXAM" && s.year !== null;

/**
 * The single rule for when a question may be presented as a real previous-year question.
 * Demo data and AI-written questions can never qualify.
 */
export function isRealVerifiedPyq(q: ProvenanceInput): boolean {
  return !q.isDemo && q.sourceType === "VERIFIED_PYQ" && q.verificationStatus === "VERIFIED" && q.sources.some(isBoardPaperWithYear);
}

/**
 * Validates an admin write. Returns an error message, or null when the provenance is consistent.
 * `previous` is the stored state before the edit, when editing.
 */
export function validateProvenance(q: ProvenanceInput, previous?: { sourceType: SourceType; answerSource?: string }): string | null {
  if (q.isDemo && q.sourceType !== "AI_SUPPLEMENTARY") {
    return "Demo questions were written by AI. They can only be AI practice questions.";
  }
  if (previous?.sourceType === "AI_SUPPLEMENTARY" && q.sourceType === "VERIFIED_PYQ") {
    return "An AI-generated question can't become a previous-year question. If this question really appeared in a paper, add it as a new question from that paper.";
  }
  if (q.isDemo) return null;
  if (q.sourceType === "VERIFIED_PYQ" && q.verificationStatus === "VERIFIED" && !q.sources.some(isBoardPaperWithYear)) {
    return "A question can only be marked Verified PYQ once it is linked to a board exam paper with a year. Save it as pending review, link the source paper, then verify it.";
  }
  if (q.sourceType === "OFFICIAL_SAMPLE" && q.verificationStatus === "VERIFIED") {
    if (!q.sources.some((s) => !s.isDemo && ["SPECIMEN", "SAMPLE", "BOARD_EXAM"].includes(s.paperType))) {
      return "Link the official specimen or sample paper before marking this Official sample question as Verified.";
    }
  }
  if (q.sourceType === "PENDING_REVIEW" && q.verificationStatus === "VERIFIED") {
    return "Choose what the question is (PYQ, official sample, community or AI practice) before verifying it.";
  }
  return null;
}

/** Years shown next to a real verified PYQ, e.g. "2026, 2024". Never produces a year for demo, AI or unverified items. */
export function provenanceYears(q: ProvenanceInput): string | null {
  if (!isRealVerifiedPyq(q)) return null;
  const years = [...new Set(q.sources.filter(isBoardPaperWithYear).map((s) => s.year as number))].sort((a, b) => b - a);
  return years.length ? years.join(", ") : null;
}

/**
 * Frequency backed only by stored links across the question's duplicate group.
 * `groupSources` should contain the sources of every question in the canonical group.
 * Distinct exam years are what make a question "repeated"; several sets of one year are not.
 */
export function frequencyOf(groupSources: SourceLink[]) {
  const board = groupSources.filter(isBoardPaperWithYear);
  const years = [...new Set(board.map((s) => s.year as number))].sort((a, b) => b - a);
  const papers = new Set(board.map((s) => s.paperId)).size;
  // Paper sets per exam year: several sets of one year are one sitting, not a repeat.
  const setsByYear = new Map<number, number>();
  for (const y of years) setsByYear.set(y, new Set(board.filter((s) => s.year === y).map((s) => s.paperId)).size);
  return { years, papers, setsByYear };
}

/**
 * Factual frequency wording. Distinct exam years and same-year sets are reported separately:
 *   "Appeared in 3 verified exam years (2026, 2025, 2023)"
 *   "Seen in 2 paper sets of the 2026 exam (one exam year)"
 */
export function frequencyLine(q: ProvenanceInput, groupSources: SourceLink[] = q.sources): string | null {
  if (!isRealVerifiedPyq(q)) return null;
  const { years, papers } = frequencyOf(groupSources);
  if (years.length >= 2) {
    const sets = papers > years.length ? `, ${papers} paper sets in all` : "";
    return `Appeared in ${years.length} verified exam years (${years.join(", ")})${sets}`;
  }
  if (papers >= 2 && years.length === 1) return `Seen in ${papers} paper sets of the ${years[0]} exam (one exam year)`;
  return null;
}

/** Short factual trend tags for a verified PYQ. `latestYear` is the most recent verified year for its subject. */
export function trendTags(q: ProvenanceInput, groupSources: SourceLink[] = q.sources, latestYear?: number | null): string[] {
  if (!isRealVerifiedPyq(q)) return [];
  const { years, papers } = frequencyOf(groupSources);
  const tags: string[] = [];
  if (years.length >= 2) tags.push(`${years.length} exam years`);
  else if (papers >= 2) tags.push(`${papers} sets, ${years[0]}`);
  if (latestYear && years[0] === latestYear) tags.push(`Recent: ${latestYear}`);
  if (years.length && years[years.length - 1] < (latestYear ?? years[0]) - 2) tags.push(`First seen ${years[years.length - 1]}`);
  return tags;
}

/** One-line citation for a source link, built only from stored fields. */
export function citation(s: SourceLink): string {
  const parts = [s.boardName, s.year && !s.isDemo ? String(s.year) : null, s.paperCode ? `Q.P. ${s.paperCode}` : null];
  const q = s.questionNumber ? `Q${s.questionNumber}${s.part ?? ""}` : null;
  return [...parts, q].filter(Boolean).join(", ") || s.title;
}
