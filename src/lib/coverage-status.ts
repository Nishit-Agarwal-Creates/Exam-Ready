/** Honest coverage wording from verified, source-backed counts only (AI practice never counts). */
export function coverageStatus(c: { verifiedPyq: number; officialSample: number; community: number }): {
  label: string;
  tone: "strong" | "growing" | "limited" | "none";
} {
  const n = c.verifiedPyq + c.officialSample + c.community;
  if (n >= 150) return { label: "Strong coverage", tone: "strong" };
  if (n >= 50) return { label: "Growing coverage", tone: "growing" };
  if (n > 0) return { label: "Limited coverage", tone: "limited" };
  return { label: "No verified material yet", tone: "none" };
}
