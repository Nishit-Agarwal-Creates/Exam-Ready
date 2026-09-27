import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type DB = ReturnType<typeof drizzle<typeof schema>>;

export async function getEnv(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as CloudflareEnv;
}

export async function getDb(): Promise<DB> {
  const env = await getEnv();
  if (!env.DB) throw new Error("D1 binding `DB` is not configured. See README → Local development.");
  return drizzle(env.DB, { schema });
}

export { schema };
