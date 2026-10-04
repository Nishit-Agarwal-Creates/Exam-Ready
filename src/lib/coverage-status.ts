/** Honest coverage wording from verified, source-backed counts only (AI practice never counts). */
export function coverageStatus(c: { verifiedPyq: number; officialSample: number; community: number }, scope: "subject" | "class" = "subject"): {
  label: string;
  tone: "strong" | "growing" | "limited" | "none";
} {
  const n = c.verifiedPyq + c.officialSample + c.community;
  // A whole class is measured against the 600-question goal; a single subject against a smaller bar.
  const [strong, growing] = scope === "class" ? [600, 200] : [150, 50];
  if (n >= strong) return { label: "Strong coverage", tone: "strong" };
  if (n >= growing) return { label: "Growing coverage", tone: "growing" };
  if (n > 0) return { label: "Limited coverage", tone: "limited" };
  return { label: "No verified material yet", tone: "none" };
}
