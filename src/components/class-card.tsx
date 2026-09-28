import Link from "next/link";
import { SubjectGlyph } from "./subject-glyph";

export type ClassCardData = {
  href: string;
  boardSlug: string;
  level: number;
  name: string;
  /** Verified, source-backed questions (PYQs + official samples/specimens + community). */
  sourced: number;
  aiPractice: number;
  awaiting: number;
  subjects: { slug: string; name: string }[];
};

/** What happens at the end of this class, stated plainly. */
function stage(board: string, level: number) {
  if (level === 10) return board === "icse" ? "ICSE board exam year" : "CBSE board exam year";
  if (level === 12) return board === "icse" ? "ISC board exam year" : "CBSE board exam year";
  return "School exams";
}

/**
 * A class as an exam sheet: ruled paper, red margin, a large numeral and honest counts. Hover lifts it
 * (fine pointers), a press ripples (every pointer); `selected` stamps it. Pure markup, no client code.
 */
export function ClassCard({ c, selected = false, style }: { c: ClassCardData; selected?: boolean; style?: React.CSSProperties }) {
  return (
    <Link
      href={c.href}
      className="class-card glyph-host tilt-card"
      data-selected={selected || undefined}
      aria-current={selected ? "page" : undefined}
      data-fx="ripple"
      style={style}
    >
      <span className="class-card-stage">{stage(c.boardSlug, c.level)}</span>
      <span className="class-card-title">
        <span className="class-card-word">Class</span>
        <span className="class-card-numeral numeral-roll">{c.level}</span>
      </span>
      <span className="class-card-stats">
        {c.sourced > 0 ? (
          <span className="font-bold text-verified">
            <span className="num">{c.sourced}</span> verified
          </span>
        ) : c.awaiting > 0 ? (
          <span className="text-pending">
            <span className="num">{c.awaiting}</span> in review
          </span>
        ) : (
          <span className="text-pencil">No verified material yet</span>
        )}
        {c.aiPractice > 0 && (
          <span className="text-ai">
            <span className="num">{c.aiPractice}</span> AI practice
          </span>
        )}
      </span>
      {c.subjects.length > 0 && (
        <span className="class-card-glyphs" aria-label={c.subjects.map((s) => s.name).join(", ")}>
          {c.subjects.slice(0, 6).map((s) => (
            <SubjectGlyph key={s.slug} slug={s.slug} size={20} />
          ))}
        </span>
      )}
      {selected && (
        <span className="class-card-stamp" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 6.5 4.8 9 10 3" />
          </svg>
        </span>
      )}
    </Link>
  );
}
