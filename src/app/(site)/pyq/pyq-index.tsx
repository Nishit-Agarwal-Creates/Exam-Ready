import Link from "next/link";
import { SubjectGlyph } from "@/components/subject-glyph";
import type { SubjectCoverage } from "@/lib/data/coverage";

/** Shared list of subjects for the /pyq hubs, with honest availability. */
export function PyqSubjectList({ rows }: { rows: SubjectCoverage[] }) {
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => {
        const has = r.verifiedPyq > 0;
        return (
          <li key={r.subjectId}>
            <Link
              href={`/pyq/${r.boardSlug}/${r.classSlug}/${r.subjectSlug}`}
              className="glyph-host tilt-card flex h-full items-start gap-3 rounded-2xl border border-rule bg-sheet p-4"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-ink-line bg-ink-soft text-ink">
                <SubjectGlyph slug={r.subjectSlug} size={34} />
              </span>
              <span className="min-w-0">
                <span className="block font-bold">
                  {r.className} {r.subjectName}
                </span>
                <span className="mt-1 block text-[0.88rem]">
                  {has ? (
                    <span className="font-bold text-verified">
                      {r.verifiedPyq} verified PYQs, {r.years.join(", ")}
                    </span>
                  ) : r.awaitingPyq > 0 ? (
                    <span className="text-pending">
                      {r.awaitingPyq} extracted from board papers, awaiting review{r.pendingYears.length ? ` (${r.pendingYears.join(", ")})` : ""}
                    </span>
                  ) : (
                    <span className="text-pencil">Source collection in progress</span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
