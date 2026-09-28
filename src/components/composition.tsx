import type { SourceType } from "@/db/schema";
import type { Composition } from "@/lib/engine/generator";
import { DEMO_SOURCE_LABELS, SOURCE_LABELS } from "@/lib/provenance";

const ORDER: SourceType[] = ["VERIFIED_PYQ", "OFFICIAL_SAMPLE", "USER_CONTRIBUTED", "AI_SUPPLEMENTARY", "PENDING_REVIEW"];
const FILL: Record<SourceType, string> = {
  VERIFIED_PYQ: "var(--color-verified)",
  OFFICIAL_SAMPLE: "var(--color-official)",
  USER_CONTRIBUTED: "var(--color-contrib)",
  AI_SUPPLEMENTARY: "var(--color-ai)",
  PENDING_REVIEW: "var(--color-pending)",
};
// Patterns keep categories distinguishable without relying on colour alone.
const PATTERN: Record<SourceType, string> = {
  VERIFIED_PYQ: "none",
  OFFICIAL_SAMPLE: "repeating-linear-gradient(90deg, transparent 0 6px, rgb(255 255 255 / 0.28) 6px 8px)",
  USER_CONTRIBUTED: "repeating-linear-gradient(45deg, transparent 0 5px, rgb(255 255 255 / 0.3) 5px 7px)",
  AI_SUPPLEMENTARY: "radial-gradient(rgb(255 255 255 / 0.35) 1px, transparent 1.5px) 0 0 / 6px 6px",
  PENDING_REVIEW: "repeating-linear-gradient(-45deg, transparent 0 4px, rgb(255 255 255 / 0.35) 4px 6px)",
};

/** Share of marks by source category, computed from the questions actually on the paper. */
export function CompositionBar({ composition, demo, caption }: { composition: Composition; demo: boolean; caption?: string }) {
  const total = ORDER.reduce((s, k) => s + composition[k].marks, 0);
  const rows = ORDER.filter((k) => composition[k].count > 0);
  const pctOf = (k: SourceType) => (total ? Math.round((composition[k].marks / total) * 100) : 0);
  return (
    <figure className="m-0">
      {caption && <figcaption className="mb-2 text-sm font-bold text-pencil">{caption}</figcaption>}
      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-desk-deep" aria-hidden="true">
        {rows.map((k) => (
          <span
            key={k}
            style={{ width: `${(composition[k].marks / (total || 1)) * 100}%`, background: `${PATTERN[k]}, ${FILL[k]}` }}
            className="h-full border-r-2 border-sheet last:border-r-0"
          />
        ))}
      </div>
      <ul className="mt-3 grid gap-1.5 text-[0.93rem]">
        {rows.length === 0 && <li className="text-pencil">No questions yet.</li>}
        {rows.map((k) => (
          <li key={k} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block size-3 shrink-0 rounded-sm" style={{ background: `${PATTERN[k]}, ${FILL[k]}` }} />
              {demo && k !== "VERIFIED_PYQ" ? DEMO_SOURCE_LABELS[k] : SOURCE_LABELS[k].short}
            </span>
            <span className="num whitespace-nowrap text-pencil">
              <strong className="text-graphite">{pctOf(k)}%</strong> ({composition[k].marks} marks, {composition[k].count} Q)
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
