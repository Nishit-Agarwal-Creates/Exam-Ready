import type { PaperType, SourceType, VerificationStatus } from "@/db/schema";

export const DEMO_LABEL = "DEMO DATA — NOT A VERIFIED PREVIOUS-YEAR QUESTION";

export const SOURCE_LABELS: Record<SourceType, { short: string; long: string; description: string }> = {
  VERIFIED_PYQ: {
    short: "Verified PYQ",
    long: "Verified previous-year question",
    description: "Checked against the listed board exam paper. The year and paper shown are its source.",
  },
  OFFICIAL_SAMPLE: {
    short: "Official sample",
    long: "Official sample or specimen question",
    description: "From official sample, specimen or practice material. It did not necessarily appear in a board exam.",
  },
  USER_CONTRIBUTED: {
    short: "Contributed",
    long: "Contributed question",
    description: "Added by a contributor. It is not claimed to be from a past paper.",
  },
  AI_SUPPLEMENTARY: {
    short: "AI-generated",
    long: "AI-generated practice question",
    description: "Written by AI to fill gaps. It has never appeared in an exam.",
  },
};

/** Label used for demo stand-ins in composition breakdowns, so demo data never reads as a real category. */
export const DEMO_SOURCE_LABELS: Record<SourceType, string> = {
  VERIFIED_PYQ: "Demo stand-ins for verified PYQs",
  OFFICIAL_SAMPLE: "Demo stand-ins for official samples",
  USER_CONTRIBUTED: "Demo contributed questions",
  AI_SUPPLEMENTARY: "Demo AI-style questions",
};

export const STATUS_LABELS: Record<VerificationStatus, string> = {
  VERIFIED: "Verified",
  UNVERIFIED: "Unverified",
  REJECTED: "Rejected",
};

export const PAPER_TYPE_LABELS: Record<PaperType, string> = {
  BOARD_EXAM: "Board exam paper",
  SPECIMEN: "Specimen paper",
  SAMPLE: "Sample paper",
  SCHOOL_EXAM: "School exam paper",
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
};

export type ProvenanceInput = {
  sourceType: SourceType;
  verificationStatus: VerificationStatus;
  isDemo: boolean;
  sources: SourceLink[];
};

/**
 * The single rule for when a question may be presented as a real previous-year question.
 * Demo data can never qualify, whatever its category.
 */
export function isRealVerifiedPyq(q: ProvenanceInput): boolean {
  return (
    !q.isDemo &&
    q.sourceType === "VERIFIED_PYQ" &&
    q.verificationStatus === "VERIFIED" &&
    q.sources.some((s) => !s.isDemo && s.paperType === "BOARD_EXAM" && s.year !== null)
  );
}

/** Validates an admin write. Returns an error message, or null when the provenance is consistent. */
export function validateProvenance(q: ProvenanceInput): string | null {
  if (q.isDemo) return null;
  if (q.sourceType === "VERIFIED_PYQ" && q.verificationStatus === "VERIFIED") {
    if (!q.sources.some((s) => !s.isDemo && s.paperType === "BOARD_EXAM" && s.year !== null)) {
      return "A question can only be marked Verified PYQ once it is linked to a board exam paper with a year. Save it as Unverified, link the source paper, then verify it.";
    }
  }
  if (q.sourceType === "OFFICIAL_SAMPLE" && q.verificationStatus === "VERIFIED") {
    if (!q.sources.some((s) => !s.isDemo && ["SPECIMEN", "SAMPLE", "BOARD_EXAM"].includes(s.paperType))) {
      return "Link the official specimen or sample paper before marking this Official sample question as Verified.";
    }
  }
  return null;
}

/** Years shown next to a real verified PYQ, e.g. "2023, 2019". Never produces a year for demo or unverified items. */
export function provenanceYears(q: ProvenanceInput): string | null {
  if (!isRealVerifiedPyq(q)) return null;
  const years = [...new Set(q.sources.filter((s) => !s.isDemo && s.paperType === "BOARD_EXAM" && s.year).map((s) => s.year as number))].sort(
    (a, b) => b - a,
  );
  return years.length ? years.join(", ") : null;
}

/** Frequency text backed only by stored links. Returns null below two appearances. */
export function frequencyLine(q: ProvenanceInput): string | null {
  const boardPapers = q.sources.filter((s) => s.paperType === "BOARD_EXAM" && s.isDemo === q.isDemo && (q.isDemo || s.year !== null));
  if (boardPapers.length < 2) return null;
  return q.isDemo ? `Linked to ${boardPapers.length} fictional demo papers` : `Asked in ${boardPapers.length} stored board papers`;
}
