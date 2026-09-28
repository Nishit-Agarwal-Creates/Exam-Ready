// Bindings available on the Cloudflare Worker. Regenerate with `npm run cf-typegen` after editing wrangler.jsonc.
interface CloudflareEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  SITE_URL: string;
  SHOW_DEMO_DATA: string;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
  /** Workers AI binding (optional). */
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
}
