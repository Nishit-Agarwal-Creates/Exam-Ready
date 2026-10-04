/**
 * Tiny, safe notation markup used by source packs where Unicode has no super/subscript character:
 *   x^2, 10^8, X^C, e^(−Ea/RT), x^{n+1}   → superscript
 *   ∫_{π/4}^{3π/4}, K_{b}                  → subscript (braces only, so "____" blanks are never touched)
 * Parsing is pure so it can be tested and reused (web and PDF).
 */
/** Text with indented lines (program code): leading spaces must be kept when it is displayed. */
export const isIndented = (s: string | null | undefined) => Boolean(s && /\n[ \t]+\S/.test(s));

export type MathPart = { kind: "text" | "sup" | "sub"; value: string };

const TOKEN = /\^\{([^{}]+)\}|\^\(((?:[^()]|\([^()]*\))+)\)|\^(-?\d+|[A-Za-z])(?![A-Za-z])|_\{([^{}]+)\}/g;

export function parseMath(s: string): MathPart[] {
  const out: MathPart[] = [];
  let last = 0;
  for (const m of s.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ kind: "text", value: s.slice(last, i) });
    if (m[4] !== undefined) out.push({ kind: "sub", value: m[4] });
    else out.push({ kind: "sup", value: m[1] ?? m[2] ?? m[3] });
    last = i + m[0].length;
  }
  if (last < s.length) out.push({ kind: "text", value: s.slice(last) });
  return out;
}
