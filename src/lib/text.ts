/** Lower-cases and strips punctuation so trivially different copies of a question hash the same. Must match scripts/build-seed.mjs. */
export function normaliseForHash(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

export async function contentHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(normaliseForHash(text));
  const digest = await crypto.subtle.digest("SHA-1", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Word-set Jaccard similarity, used to flag likely duplicates during import. */
export function similarity(a: string, b: string): number {
  const wa = new Set(normaliseForHash(a).split(" ").filter((w) => w.length > 2));
  const wb = new Set(normaliseForHash(b).split(" ").filter((w) => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return sec ? `${m} min ${sec} s` : `${m} min`;
  return `${sec} s`;
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

export function randomId(bytes = 9): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
