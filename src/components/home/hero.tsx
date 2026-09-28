import Link from "next/link";
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

/** Academic objects that start dispersed and converge toward the centre card. */
const OBJECTS: { key: string; x: string; y: string; fromX: string; fromY: string; r: string; depth: number; size: number; d: number; o?: number }[] = [
  { key: "flask", x: "6%", y: "18%", fromX: "-140px", fromY: "-60px", r: "-30deg", depth: 22, size: 64, d: 0 },
  { key: "atom", x: "84%", y: "10%", fromX: "160px", fromY: "-80px", r: "40deg", depth: 30, size: 76, d: 80 },
  { key: "sigma", x: "90%", y: "62%", fromX: "180px", fromY: "60px", r: "25deg", depth: 18, size: 58, d: 160 },
  { key: "compass", x: "2%", y: "70%", fromX: "-160px", fromY: "90px", r: "-45deg", depth: 26, size: 70, d: 240 },
  { key: "pencil", x: "22%", y: "88%", fromX: "-60px", fromY: "160px", r: "-20deg", depth: 14, size: 60, d: 320 },
  { key: "formula", x: "70%", y: "90%", fromX: "80px", fromY: "170px", r: "15deg", depth: 12, size: 120, d: 400, o: 0.9 },
  { key: "ruler", x: "74%", y: "34%", fromX: "140px", fromY: "0px", r: "30deg", depth: 10, size: 86, d: 480, o: 0.7 },
  { key: "stamp", x: "14%", y: "40%", fromX: "-150px", fromY: "0px", r: "-15deg", depth: 16, size: 64, d: 560, o: 0.85 },
];

function ObjectArt({ kind, size }: { kind: string; size: number }) {
  const s = { width: size, height: size };
  const stroke = "rgb(214 222 255 / 0.9)";
  switch (kind) {
    case "flask":
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden="true">
          <path d="M24 6h16M27 6v16L12 50a6 6 0 0 0 5 9h30a6 6 0 0 0 5-9L37 22V6" fill="rgb(111 227 255 / 0.08)" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M17 44h30" stroke="#6fe3ff" strokeWidth="2.2" />
          <circle cx="28" cy="50" r="2.4" fill="#6fe3ff" />
          <circle cx="37" cy="53" r="1.8" fill="#6fe3ff" />
        </svg>
      );
    case "atom":
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden="true" className="orbit">
          <ellipse cx="32" cy="32" rx="26" ry="10" fill="none" stroke={stroke} strokeWidth="2" />
          <ellipse cx="32" cy="32" rx="26" ry="10" fill="none" stroke={stroke} strokeWidth="2" transform="rotate(60 32 32)" />
          <ellipse cx="32" cy="32" rx="26" ry="10" fill="none" stroke={stroke} strokeWidth="2" transform="rotate(120 32 32)" />
          <circle cx="32" cy="32" r="4.5" fill="#ff5a6a" />
        </svg>
      );
    case "sigma":
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden="true">
          <rect x="4" y="4" width="56" height="56" rx="14" fill="rgb(255 255 255 / 0.05)" stroke="rgb(255 255 255 / 0.18)" />
          <path d="M44 18H22l12 14-12 14h22" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "compass":
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="12" r="5" fill="none" stroke={stroke} strokeWidth="2.2" />
          <path d="M30 16 16 56M34 16l14 40M21 42h22" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M8 52a28 28 0 0 0 48 0" fill="none" stroke="#6fe3ff" strokeWidth="1.6" strokeDasharray="3 4" />
        </svg>
      );
    case "pencil":
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden="true">
          <path d="M12 52 44 20l8 8-32 32H12v-8Z" fill="rgb(255 228 92 / 0.18)" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="m40 24 8 8M12 52l8 8" stroke={stroke} strokeWidth="2.2" />
          <path d="m44 20 4-4a4 4 0 0 1 6 0l2 2a4 4 0 0 1 0 6l-4 4" fill="#ff5a6a" stroke="#ff5a6a" strokeWidth="1" />
        </svg>
      );
    case "formula":
      return (
        <svg width={size} height={size * 0.42} viewBox="0 0 120 50" aria-hidden="true">
          <rect x="1" y="1" width="118" height="48" rx="12" fill="rgb(255 255 255 / 0.06)" stroke="rgb(255 255 255 / 0.18)" />
          <text x="60" y="32" textAnchor="middle" fontFamily="Newsreader, Georgia, serif" fontSize="19" fill="#e6ebff">
            V = IR
          </text>
        </svg>
      );
    case "ruler":
      return (
        <svg width={size} height={size * 0.34} viewBox="0 0 90 30" aria-hidden="true">
          <rect x="1" y="1" width="88" height="28" rx="5" fill="rgb(111 227 255 / 0.08)" stroke={stroke} strokeWidth="1.8" />
          {Array.from({ length: 10 }, (_, i) => (
            <path key={i} d={`M${8 + i * 8} 1v${i % 2 ? 7 : 12}`} stroke={stroke} strokeWidth="1.4" />
          ))}
        </svg>
      );
    case "stamp":
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="26" fill="none" stroke="#3ddc97" strokeWidth="2.5" strokeDasharray="5 3" />
          <path d="m21 33 7 7 15-17" fill="none" stroke="#3ddc97" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  top: `${(i * 53) % 100}%`,
  t: `${3 + (i % 5)}s`,
  d: `${(i % 7) * 0.4}s`,
}));

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
            <div className="rise-in mt-9 flex flex-col gap-3 sm:flex-row" style={{ ["--d" as string]: "240ms" }}>
              <Link href="/pyqs" className="btn btn-glow px-6 text-[1.05rem]" data-magnetic>
                Explore PYQs
              </Link>
              <Link href="/practice" className="btn btn-night px-6 text-[1.05rem]" data-magnetic>
                Build a paper
              </Link>
            </div>
            <p className="rise-in mt-6 text-[0.95rem] text-soft" style={{ ["--d" as string]: "320ms" }}>
              Free to use. No sign-up. Verified questions are backed by their listed source.
            </p>
          </div>

          <div className="relative mx-auto aspect-[1/1] w-full max-w-[34rem] lg:max-w-none">
            {OBJECTS.map((o) => (
              <div
                key={o.key}
                aria-hidden="true"
                className="parallax absolute"
                style={{ left: o.x, top: o.y, ["--depth" as string]: `${o.depth}px` }}
              >
                <div
                  className="converge"
                  style={{
                    ["--from-x" as string]: o.fromX,
                    ["--from-y" as string]: o.fromY,
                    ["--from-r" as string]: o.r,
                    ["--d" as string]: `${o.d}ms`,
                    ["--o" as string]: String(o.o ?? 1),
                    ["--float" as string]: `${-6 - (o.depth % 7)}px`,
                  }}
                >
                  <ObjectArt kind={o.key} size={o.size} />
                </div>
              </div>
            ))}
            <div className="parallax absolute inset-[16%] grid place-items-center" style={{ ["--depth" as string]: "-8px" }}>
              <SourceCard source={source} />
            </div>
          </div>
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
