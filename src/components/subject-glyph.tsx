/**
 * A small line glyph per subject. Its motion runs when the surrounding `.glyph-host` is hovered or
 * focused (see globals.css): physics sends a pulse along a circuit, chemistry spins an electron,
 * biology twists DNA, mathematics draws a compass arc, history unrolls a scroll, geography turns the
 * globe's meridians, English writes a line. Decorative only.
 */
export function SubjectGlyph({ slug, size = 44 }: { slug: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 48 48", className: "glyph shrink-0", "aria-hidden": true, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (slug) {
    case "physics":
      return (
        <svg {...common}>
          <path id="g-phy" d="M6 30h8l3-6 4 12 4-12 4 12 3-6h10" />
          <path d="M38 14v10M42 17v4" stroke="var(--color-margin)" />
          <circle r="2.6" fill="var(--color-glow)" stroke="none" className="g-pulse" style={{ offsetPath: "path('M6 30h8l3-6 4 12 4-12 4 12 3-6h10')" }} />
        </svg>
      );
    case "chemistry":
      return (
        <svg {...common}>
          <path d="M24 8 38 16v16l-14 8-14-8V16Z" />
          <g className="g-spin">
            <ellipse cx="24" cy="24" rx="17" ry="6" stroke="var(--color-glow)" strokeWidth="1.5" />
            <circle cx="41" cy="24" r="2.4" fill="var(--color-margin)" stroke="none" />
          </g>
        </svg>
      );
    case "biology":
      return (
        <svg {...common}>
          <g className="g-twist">
            <path d="M16 6c0 12 16 12 16 18s-16 6-16 18" />
            <path d="M32 6c0 12-16 12-16 18s16 6 16 18" stroke="var(--color-verified)" />
            <path d="M19 12h10M18 36h12M21 19h6M21 29h6" strokeWidth="1.4" />
          </g>
        </svg>
      );
    case "mathematics":
      return (
        <svg {...common}>
          <path d="M24 8 12 38M24 8l12 30M17 26h14" />
          <circle cx="24" cy="8" r="2.5" />
          <path d="M8 38a17 17 0 0 0 32 0" className="g-draw" stroke="var(--color-margin)" style={{ ["--len" as string]: "60" }} />
        </svg>
      );
    case "science":
      return (
        <svg {...common}>
          <path d="M19 6h10M21 6v12L10 38a4 4 0 0 0 3.6 5.6h20.8A4 4 0 0 0 38 38L27 18V6" />
          <path d="M14 32h20" className="g-draw" stroke="var(--color-glow)" style={{ ["--len" as string]: "20" }} />
          <circle cx="22" cy="37" r="1.8" fill="currentColor" className="g-drop" />
          <circle cx="28" cy="39" r="1.3" fill="currentColor" className="g-drop" />
        </svg>
      );
    case "history-civics":
    case "history":
      return (
        <svg {...common}>
          <path d="M10 10h26a4 4 0 0 1 0 8h-2v18a4 4 0 0 1-4 4H10a4 4 0 0 1 0-8h2V14a4 4 0 0 0-4-4" className="g-unroll" />
          <path d="M18 22h10M18 28h8" strokeWidth="1.5" />
        </svg>
      );
    case "geography":
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="16" />
          <clipPath id="g-geo-clip">
            <circle cx="24" cy="24" r="16" />
          </clipPath>
          <g clipPath="url(#g-geo-clip)">
            <g className="g-slide" style={{ ["--slide" as string]: "10px" }}>
              <path d="M4 8c0 10 0 22 0 32M14 8c-4 10-4 22 0 32M24 8c-4 10-4 22 0 32M34 8c-4 10-4 22 0 32M44 8c-4 10-4 22 0 32" strokeWidth="1.3" />
            </g>
          </g>
          <path d="M9 24h30" strokeWidth="1.3" />
        </svg>
      );
    case "social-science":
      return (
        <svg {...common}>
          <path d="M6 12 18 8l12 4 12-4v28l-12 4-12-4-12 4Z" />
          <path d="M18 8v28M30 12v28" strokeWidth="1.4" />
          <path d="M24 30c-4-5-5-8-5-10a5 5 0 0 1 10 0c0 2-1 5-5 10Z" fill="var(--color-margin)" stroke="none" className="g-drop" />
        </svg>
      );
    case "english":
      return (
        <svg {...common}>
          <path d="M8 38c6-2 10-2 14 0s8 2 12 0" className="g-draw" style={{ ["--len" as string]: "40" }} />
          <path d="m30 8 8 8-16 16h-8v-8Z" />
          <path d="m26 12 8 8" />
        </svg>
      );
    case "computer-applications":
    case "computer-science":
      return (
        <svg {...common}>
          <rect x="6" y="10" width="36" height="24" rx="3" />
          <path d="M16 40h16M24 34v6" />
          <path d="m15 19 4 3-4 3M22 26h8" className="g-draw" stroke="var(--color-glow)" style={{ ["--len" as string]: "30" }} />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M24 12c-5-3-11-3-17-1v26c6-2 12-2 17 1 5-3 11-3 17-1V11c-6-2-12-2-17 1Z" />
          <path d="M24 12v26" className="g-draw" style={{ ["--len" as string]: "26" }} />
        </svg>
      );
  }
}
