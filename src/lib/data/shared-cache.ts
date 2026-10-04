/**
 * Two-level cache for expensive, site-wide aggregates.
 *
 * D1's free plan allows 5 million rows read per day, and aggregates such as coverage read tens of thousands of
 * rows each time. Results are kept in this Worker isolate's memory and in the `cache_entries` table (one row per
 * key), so a request reads at most one row instead of re-aggregating. Entries expire after `ttlSeconds`; editor
 * actions call clearSharedCache() so their changes show at once. If the table is missing (migration not applied
 * yet), everything still works uncached.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

type Codec<T> = { encode: (v: T) => unknown; decode: (v: unknown) => T };
const plain = { encode: (v: unknown) => v, decode: (v: unknown) => v };

const memory = new Map<string, { expires: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export async function sharedCache<T>(key: string, ttlSeconds: number, compute: () => Promise<T>, codec: Codec<T> = plain as Codec<T>): Promise<T> {
  const now = Date.now();
  const hit = memory.get(key);
  if (hit && hit.expires > now) return hit.value as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const job = (async () => {
    const db = await getDb();
    try {
      const [row] = await db.all<{ value: string; expires_at: number }>(sql`SELECT value, expires_at FROM cache_entries WHERE key = ${key} AND expires_at > ${now}`);
      if (row) {
        const value = codec.decode(JSON.parse(row.value));
        memory.set(key, { expires: Math.min(row.expires_at, now + ttlSeconds * 1000), value });
        return value;
      }
    } catch {
      // Table not there yet: fall through and compute.
    }
    const value = await compute();
    const expires = now + ttlSeconds * 1000;
    memory.set(key, { expires, value });
    try {
      await db.run(sql`INSERT INTO cache_entries (key, value, expires_at) VALUES (${key}, ${JSON.stringify(codec.encode(value))}, ${expires})
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`);
    } catch {
      // Best effort: the in-memory copy still helps.
    }
    return value;
  })();
  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}

/** Forget every cached aggregate (after an editor verifies, rejects, imports or edits). */
export async function clearSharedCache() {
  memory.clear();
  // The rendered-page cache kept by the Worker entry (worker.ts) in this isolate.
  (globalThis as { __erPageCache?: Map<string, unknown> }).__erPageCache?.clear();
  try {
    const db = await getDb();
    await db.run(sql`DELETE FROM cache_entries`);
  } catch {
    // Nothing cached yet.
  }
}

/** Codec for Map<K, V> values, which JSON cannot represent directly. */
export function mapCodec<K, V>(): Codec<Map<K, V>> {
  return { encode: (m) => [...m.entries()], decode: (v) => new Map(v as [K, V][]) };
}

/** Site-wide aggregates refresh at least this often even without editor actions. */
export const AGGREGATE_TTL = 600;
