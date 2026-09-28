/** Line-art study objects for the homepage field. Pure SVG, decorative (aria-hidden). */
const STROKE = "rgb(214 222 255 / 0.9)";
const GLOW = "#6fe3ff";
const PEN = "#ff5a6a";
const MINT = "#3ddc97";
const GOLD = "#ffe45c";

export type ArtKind =
  | "flask"
  | "atom"
  | "sigma"
  | "compass"
  | "pencil"
  | "formula"
  | "ruler"
  | "stamp"
  | "dna"
  | "globe"
  | "book"
  | "graph"
  | "molecule"
  | "circuit"
  | "protractor"
  | "scroll"
  | "magnet";

export function AcademicArt({ kind, size }: { kind: ArtKind; size: number }) {
  const s = { width: size, height: size };
  switch (kind) {
    case "flask":
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden="true">
          <path d="M24 6h16M27 6v16L12 50a6 6 0 0 0 5 9h30a6 6 0 0 0 5-9L37 22V6" fill="rgb(111 227 255 / 0.08)" stroke={STROKE} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M17 44h30" stroke={GLOW} strokeWidth="2.2" />
          <circle cx="28" cy="50" r="2.4" fill={GLOW} />
          <circle cx="37" cy="53" r="1.8" fill={GLOW} />
        </svg>
      );
    case "atom":
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden="true" className="orbit">
          <ellipse cx="32" cy="32" rx="26" ry="10" fill="none" stroke={STROKE} strokeWidth="2" />
          <ellipse cx="32" cy="32" rx="26" ry="10" fill="none" stroke={STROKE} strokeWidth="2" transform="rotate(60 32 32)" />
          <ellipse cx="32" cy="32" rx="26" ry="10" fill="none" stroke={STROKE} strokeWidth="2" transform="rotate(120 32 32)" />
          <circle cx="32" cy="32" r="4.5" fill={PEN} />
          <circle cx="58" cy="32" r="2.4" fill={GLOW} />
        </svg>
      );
    case "sigma":
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden="true">
          <rect x="4" y="4" width="56" height="56" rx="14" fill="rgb(255 255 255 / 0.05)" stroke="rgb(255 255 255 / 0.18)" />
          <path d="M44 18H22l12 14-12 14h22" fill="none" stroke={STROKE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "compass":
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="12" r="5" fill="none" stroke={STROKE} strokeWidth="2.2" />
          <path d="M30 16 16 56M34 16l14 40M21 42h22" fill="none" stroke={STROKE} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M8 52a28 28 0 0 0 48 0" fill="none" stroke={GLOW} strokeWidth="1.6" strokeDasharray="3 4" />
        </svg>
      );
    case "pencil":
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden="true">
          <path d="M12 52 44 20l8 8-32 32H12v-8Z" fill="rgb(255 228 92 / 0.18)" stroke={STROKE} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="m40 24 8 8M12 52l8 8" stroke={STROKE} strokeWidth="2.2" />
          <path d="m44 20 4-4a4 4 0 0 1 6 0l2 2a4 4 0 0 1 0 6l-4 4" fill={PEN} stroke={PEN} strokeWidth="1" />
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
          <rect x="1" y="1" width="88" height="28" rx="5" fill="rgb(111 227 255 / 0.08)" stroke={STROKE} strokeWidth="1.8" />
          {Array.from({ length: 10 }, (_, i) => (
            <path key={i} d={`M${8 + i * 8} 1v${i % 2 ? 7 : 12}`} stroke={STROKE} strokeWidth="1.4" />
          ))}
        </svg>
      );
    case "stamp":
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="26" fill="none" stroke={MINT} strokeWidth="2.5" strokeDasharray="5 3" />
          <path d="m21 33 7 7 15-17" fill="none" stroke={MINT} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "dna":
      return (
        <svg width={size * 0.55} height={size} viewBox="0 0 36 64" aria-hidden="true">
          <path d="M6 2c0 15 24 15 24 30S6 47 6 62" fill="none" stroke={STROKE} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M30 2c0 15-24 15-24 30s24 15 24 30" fill="none" stroke={GLOW} strokeWidth="2.2" strokeLinecap="round" />
          {[9, 18, 27, 37, 46, 55].map((y) => (
            <path key={y} d={`M${y % 18 === 9 ? 10 : 8} ${y}h${y % 18 === 9 ? 16 : 20}`} stroke="rgb(214 222 255 / 0.55)" strokeWidth="1.6" />
          ))}
        </svg>
      );
    case "globe":
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="24" fill="rgb(111 227 255 / 0.06)" stroke={STROKE} strokeWidth="2" />
          <ellipse cx="32" cy="32" rx="10" ry="24" fill="none" stroke={STROKE} strokeWidth="1.5" />
          <path d="M8 32h48M12 20h40M12 44h40" fill="none" stroke="rgb(214 222 255 / 0.6)" strokeWidth="1.4" />
          <path d="M22 17c4 3 2 7 6 8s6-3 9 0M36 40c3-2 7 0 8 3" fill="none" stroke={MINT} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "book":
      return (
        <svg width={size} height={size * 0.72} viewBox="0 0 64 46" aria-hidden="true">
          <path d="M32 8C24 3 14 3 4 6v34c10-3 20-3 28 2 8-5 18-5 28-2V6C50 3 40 3 32 8Z" fill="rgb(255 255 255 / 0.05)" stroke={STROKE} strokeWidth="2" strokeLinejoin="round" />
          <path d="M32 8v34" stroke={STROKE} strokeWidth="1.6" />
          <path d="M10 14c6-1 11-1 16 1M10 21c6-1 11-1 16 1M38 15c5-2 10-2 16-1M38 22c5-2 10-2 16-1" stroke="rgb(214 222 255 / 0.5)" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "graph":
      return (
        <svg width={size} height={size * 0.7} viewBox="0 0 80 56" aria-hidden="true">
          <path d="M6 4v46h70" fill="none" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M6 42c8 0 10-30 20-30s10 30 20 30 10-30 20-30" fill="none" stroke={GLOW} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="26" cy="12" r="2.6" fill={PEN} />
        </svg>
      );
    case "molecule":
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden="true">
          <path d="M32 10 51 21v22L32 54 13 43V21Z" fill="none" stroke={STROKE} strokeWidth="2" strokeLinejoin="round" />
          <path d="M32 18 44 25v14L32 46 20 39V25Z" fill="none" stroke="rgb(214 222 255 / 0.45)" strokeWidth="1.4" />
          {[
            [32, 10],
            [51, 21],
            [51, 43],
            [32, 54],
            [13, 43],
            [13, 21],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3.4" fill={i % 2 ? GLOW : "#e6ebff"} />
          ))}
        </svg>
      );
    case "circuit":
      return (
        <svg width={size} height={size * 0.6} viewBox="0 0 80 48" aria-hidden="true">
          <path d="M6 24h14l4-8 6 16 6-16 6 16 4-8h8M54 24h6v-12H74M60 24v12h14" fill="none" stroke={STROKE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M70 6v12M76 9v6" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="6" cy="24" r="2.6" fill={GLOW} />
        </svg>
      );
    case "protractor":
      return (
        <svg width={size} height={size * 0.56} viewBox="0 0 72 40" aria-hidden="true">
          <path d="M4 36a32 32 0 0 1 64 0Z" fill="rgb(111 227 255 / 0.07)" stroke={STROKE} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M20 36a16 16 0 0 1 32 0" fill="none" stroke="rgb(214 222 255 / 0.5)" strokeWidth="1.4" />
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI - (i * Math.PI) / 8;
            const x1 = 36 + Math.cos(a) * 32;
            const y1 = 36 - Math.sin(a) * 32;
            const x2 = 36 + Math.cos(a) * 27;
            const y2 = 36 - Math.sin(a) * 27;
            return <path key={i} d={`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`} stroke={STROKE} strokeWidth="1.3" />;
          })}
          <path d="M36 36 58 14" stroke={PEN} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "scroll":
      return (
        <svg width={size} height={size * 0.7} viewBox="0 0 70 50" aria-hidden="true">
          <path d="M12 8h46a6 6 0 0 1 0 12H58v22a6 6 0 0 1-6 6H10a6 6 0 0 1 0-12h2Z" fill="rgb(255 228 92 / 0.08)" stroke={STROKE} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 8a6 6 0 0 0 0 12h46M20 28h28M20 34h22" fill="none" stroke="rgb(214 222 255 / 0.6)" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "magnet":
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden="true">
          <path d="M16 10v22a16 16 0 0 0 32 0V10H38v22a6 6 0 0 1-12 0V10Z" fill="rgb(255 255 255 / 0.04)" stroke={STROKE} strokeWidth="2" strokeLinejoin="round" />
          <path d="M16 10h10v8H16ZM38 10h10v8H38Z" fill={PEN} opacity="0.85" />
          <path d="M8 44c-3 6 0 12 6 14M56 44c3 6 0 12-6 14" fill="none" stroke={GLOW} strokeWidth="1.4" strokeDasharray="2 3" />
        </svg>
      );
    default:
      return null;
  }
}
