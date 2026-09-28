import type { PoolQuestion } from "./generator";

export type YearCoverage = { year: number; verified: number; pending: number };

/**
 * Real availability by exam year for the selection: verified PYQs and extracted questions still
 * waiting for review. Duplicate groups count once. Demo and AI questions never count.
 */
export function coverageOf(pool: PoolQuestion[]) {
  const years = new Map<number, { verified: Set<number>; pending: Set<number> }>();
  let verified = 0;
  let pending = 0;
  const seenV = new Set<number>();
  const seenP = new Set<number>();
  for (const q of pool) {
    if (q.isDemo || q.sourceType !== "VERIFIED_PYQ" || q.year === null || q.verificationStatus === "REJECTED") continue;
    const y = years.get(q.year) ?? { verified: new Set<number>(), pending: new Set<number>() };
    if (q.isRealPyq && q.isPublished) {
      y.verified.add(q.groupId);
      if (!seenV.has(q.groupId)) verified++;
      seenV.add(q.groupId);
    } else if (q.verificationStatus === "UNVERIFIED") {
      y.pending.add(q.groupId);
      if (!seenP.has(q.groupId)) pending++;
      seenP.add(q.groupId);
    }
    years.set(q.year, y);
  }
  const byYear: YearCoverage[] = [...years.entries()]
    .map(([year, v]) => ({ year, verified: v.verified.size, pending: v.pending.size }))
    .sort((a, b) => b.year - a.year);
  return { verifiedPyqs: verified, pendingPyqs: pending, byYear };
}
