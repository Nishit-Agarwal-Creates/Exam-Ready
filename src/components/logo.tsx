/**
 * ExamReady identity. The mark is an "E" whose middle stroke becomes a rising tick:
 * an exam paper's ruled lines turning into "ready". It reads at 16px and works in one colour.
 *
 *   <LogoMark />                 colour mark (midnight tile, white strokes, red-pen tick)
 *   <LogoMark variant="mono" />  single colour (currentColor), for print and dark/light overlays
 *   <Logo />                     mark + wordmark (primary logo)
 *   <Logo compact />             mark only, with an accessible name
 */
export function LogoMark({ size = 30, variant = "color", className = "" }: { size?: number; variant?: "color" | "mono"; className?: string }) {
  const mono = variant === "mono";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={`shrink-0 ${className}`}>
      {mono ? (
        <rect x="1.25" y="1.25" width="29.5" height="29.5" rx="9" fill="none" stroke="currentColor" strokeWidth="2.5" />
      ) : (
        <>
          <defs>
            <linearGradient id="er-tile" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2a38d1" />
              <stop offset="1" stopColor="#0b1033" />
            </linearGradient>
          </defs>
          <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="url(#er-tile)" />
        </>
      )}
      <path d="M10 9.5h12M10 22.5h12M10 9.5v13" fill="none" stroke={mono ? "currentColor" : "#fff"} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 16h3.2l2.3 2.6 5.7-6.6" fill="none" stroke={mono ? "currentColor" : "#ff5a6a"} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className = "", compact = false, tone = "dark" }: { className?: string; compact?: boolean; tone?: "dark" | "light" }) {
  if (compact) {
    return (
      <span className={`inline-flex ${className}`}>
        <LogoMark />
        <span className="sr-only">ExamReady</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className={`font-serif text-[1.4rem] font-semibold tracking-[-0.015em] ${tone === "light" ? "text-white" : "text-graphite"}`}>ExamReady</span>
    </span>
  );
}
