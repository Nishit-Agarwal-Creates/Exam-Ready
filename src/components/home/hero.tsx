import Link from "next/link";
import { AcademicArt, type ArtKind } from "@/components/home/academic-art";
import { AcademicField } from "@/components/motion/academic-field";
import { PointerField } from "@/components/motion/pointer-field";
import { AUTHORITY_LABELS, PAPER_TYPE_LABELS } from "@/lib/provenance";
import type { PaperType, SourceAuthority } from "@/db/schema";

export type HeroSource = {
  id: number;
  title: string;
  board: string;
  cls: string;
  subject: string;
  year: number | null;
  paperType: PaperType;
  paperCode: string | null;
  authority: SourceAuthority;
  sourceDomain: string | null;
  extracted: number;
  verified: number;
} | null;

/**
 * Study objects around the centre card. x/y are percentages of the field; depth sets parallax;
 * charge > 0 is pushed away by the cursor, charge < 0 is pulled (the magnetic ones). `phone` marks
 * the smaller set shown on narrow screens.
 */
const OBJECTS: { kind: ArtKind; x: number; y: number; depth: number; charge: number; size: number; o?: number; phone?: boolean }[] = [
  { kind: "flask", x: 3, y: 12, depth: 22, charge: 1, size: 60, phone: true },
  { kind: "book", x: 28, y: 0, depth: 12, charge: 1, size: 62 },
  { kind: "circuit", x: 55, y: 1, depth: 16, charge: 1, size: 70, phone: true },
  { kind: "atom", x: 82, y: 4, depth: 30, charge: -1, size: 72, phone: true },
  { kind: "dna", x: 94, y: 30, depth: 20, charge: 1, size: 66 },
  { kind: "sigma", x: 89, y: 57, depth: 18, charge: 1, size: 54, phone: true },
  { kind: "molecule", x: 83, y: 83, depth: 24, charge: 1, size: 60 },
  { kind: "formula", x: 55, y: 92, depth: 12, charge: 1, size: 116, o: 0.92, phone: true },
  { kind: "graph", x: 25, y: 91, depth: 14, charge: 1, size: 70 },
  { kind: "pencil", x: 4, y: 84, depth: 16, charge: 1, size: 56, phone: true },
  { kind: "compass", x: -1, y: 58, depth: 26, charge: 1, size: 64 },
  { kind: "globe", x: 0, y: 33, depth: 20, charge: -1, size: 62, phone: true },
];

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  top: `${(i * 53) % 100}%`,
  t: `${3 + (i % 5)}s`,
  d: `${(i % 7) * 0.4}s`,
}));

const SUGGESTIONS = ["Class 10 CBSE electricity", "ICSE Class 10 physics", "2026 Science QP 31/2/1"];

export function Hero({ source }: { source: HeroSource }) {
  return (
    <section aria-labelledby="hero-title" className="night overflow-hidden">
      <div className="night-mesh" aria-hidden="true" />
      <div className="night-grid" aria-hidden="true" />
      <PointerField className="relative">
        <div className="spotlight" aria-hidden="true" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {PARTICLES.map((p, i) => (
            <span key={i} className="particle" style={{ left: p.left, top: p.top, ["--t" as string]: p.t, ["--d" as string]: p.d }} />
          ))}
        </div>
        <div className="container-page grid items-center gap-14 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.02fr_1fr] lg:pb-28">
          <div className="relative z-10">
            <p className="eyebrow-chip rise-in border border-white/15 bg-white/5 text-[0.9rem] text-white/85" style={{ ["--d" as string]: "0ms" }}>
              <span className="live-dot text-[#3ddc97]" aria-hidden="true" />
              ICSE and CBSE, Classes 6 to 12
            </p>
            <h1 id="hero-title" className="rise-in mt-6 text-[2.75rem] leading-[1.02] sm:text-[3.9rem] lg:text-[4.5rem]" style={{ ["--d" as string]: "80ms" }}>
              Prepare from <span className="gradient-text">real exam questions.</span>
            </h1>
            <p className="rise-in mt-6 max-w-[36rem] text-[1.15rem] leading-relaxed text-soft sm:text-[1.25rem]" style={{ ["--d" as string]: "160ms" }}>
              Previous-year questions taken from official board papers, each one traceable to the page it came from. Build a paper, practise against the
              clock, and see exactly where every question came from.
            </p>
            <form action="/search" method="get" role="search" className="rise-in mt-8 max-w-[36rem]" style={{ ["--d" as string]: "220ms" }} data-field-focus>
              <label htmlFor="hero-q" className="sr-only">
                Search questions by chapter, topic, year or paper code
              </label>
              <div className="search-hero">
                <svg className="search-hero-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input id="hero-q" name="q" type="search" className="search-hero-input" placeholder="e.g. electricity or 31/2/1" autoComplete="off" enterKeyHint="search" />
                <button type="submit" className="btn btn-primary search-hero-button" data-fx="pulse">
                  Search
                </button>
              </div>
              <p className="mt-3 flex flex-wrap gap-2 text-[0.88rem]">
                {SUGGESTIONS.map((q) => (
                  <Link key={q} href={`/search?q=${encodeURIComponent(q)}`} className="chip-link min-h-8 px-3 text-[0.86rem]" data-fx="ripple">
                    {q}
                  </Link>
                ))}
              </p>
            </form>
            <div className="rise-in mt-7 flex flex-col gap-3 sm:flex-row" style={{ ["--d" as string]: "300ms" }}>
              <Link href="/practice" className="btn btn-glow px-6 text-[1.05rem]" data-magnetic data-fx="pulse">
                Build a paper
              </Link>
              <Link href="/pyqs" className="btn btn-night px-6 text-[1.05rem]" data-magnetic>
                Explore PYQs
              </Link>
            </div>
            <p className="rise-in mt-6 text-[0.95rem] text-soft" style={{ ["--d" as string]: "380ms" }}>
              Free to use. No sign-up. Verified questions are backed by their listed source.
            </p>
          </div>

          <AcademicField className="mx-auto aspect-[4/5] w-full max-w-[34rem] sm:aspect-square lg:max-w-none">
            {OBJECTS.map((o, i) => (
              <div
                key={o.kind}
                aria-hidden="true"
                data-field-object
                data-depth={o.depth}
                data-charge={o.charge}
                className={`field-object ${o.phone ? "" : "hidden sm:block"}`}
                style={{ ["--x" as string]: `${o.x}%`, ["--y" as string]: `${o.y}%` }}
              >
                <div
                  className="converge"
                  style={{
                    ["--from-x" as string]: `${(o.x - 50) * 3.2}px`,
                    ["--from-y" as string]: `${(o.y - 50) * 3.2}px`,
                    ["--from-r" as string]: `${(i % 2 ? 1 : -1) * (20 + i * 3)}deg`,
                    ["--d" as string]: `${i * 55}ms`,
                    ["--o" as string]: String(o.o ?? 1),
                    ["--float" as string]: `${-5 - (o.depth % 7)}px`,
                  }}
                >
                  <AcademicArt kind={o.kind} size={o.size} />
                </div>
              </div>
            ))}
            <div className="parallax absolute inset-x-[9%] inset-y-[15%] grid place-items-center sm:inset-[16%]" style={{ ["--depth" as string]: "-8px" }}>
              <SourceCard source={source} />
            </div>
          </AcademicField>
        </div>
      </PointerField>
    </section>
  );
}

function SourceCard({ source }: { source: HeroSource }) {
  return (
    <div className="expand-in glass-card w-full max-w-[22rem] p-5 text-left shadow-[var(--shadow-glow)]" style={{ ["--d" as string]: "700ms" }}>
      {source ? (
        <>
          <p className="flex items-center gap-2 text-[0.8rem] font-bold text-white/70">
            <span className="live-dot text-[#6fe3ff]" aria-hidden="true" />
            Latest official source in the bank
          </p>
          <p className="mt-3 font-serif text-[1.25rem] font-semibold leading-snug text-white">
            {source.board} {source.cls} {source.subject}
          </p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.9rem]">
            {source.year && (
              <>
                <dt className="text-white/60">Year</dt>
                <dd className="font-bold text-white">{source.year}</dd>
              </>
            )}
            <dt className="text-white/60">Paper</dt>
            <dd className="font-bold text-white">
              {PAPER_TYPE_LABELS[source.paperType]}
              {source.paperCode ? `, Q.P. ${source.paperCode}` : ""}
            </dd>
            <dt className="text-white/60">Source</dt>
            <dd className="font-bold text-white">
              {AUTHORITY_LABELS[source.authority]}
              {source.sourceDomain ? ` (${source.sourceDomain})` : ""}
            </dd>
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/15 pt-3 text-[0.88rem]">
            <span className="rounded-full bg-white/10 px-2.5 py-1 font-bold text-white">{source.extracted} questions extracted</span>
            {source.verified > 0 ? (
              <span className="rounded-full bg-[#3ddc97]/20 px-2.5 py-1 font-bold text-[#8ff0c4]">{source.verified} verified</span>
            ) : (
              <span className="rounded-full border border-dashed border-white/35 px-2.5 py-1 font-bold text-white/80">Awaiting editor review</span>
            )}
          </div>
          <Link href={`/sources/${source.id}`} className="mt-4 inline-flex text-[0.9rem] font-bold text-[#9fe9ff] underline underline-offset-4">
            See the source record
          </Link>
        </>
      ) : (
        <p className="text-white/80">Official source papers will appear here once they are added to the bank.</p>
      )}
    </div>
  );
}
