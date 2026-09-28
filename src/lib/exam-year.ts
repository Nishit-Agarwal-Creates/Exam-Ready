/** A plausible exam year from a query parameter, or undefined (so arbitrary values never become filters or cache keys). */
export function examYear(v: string): number | undefined {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1990 && n <= 2035 ? n : undefined;
}
