/**
 * AI provider abstraction. The core site never depends on AI.
 *
 *   AIProvider
 *     ├─ WorkersAIProvider  — Cloudflare Workers AI through the `AI` binding (free tier, no API key)
 *     └─ NoAIProvider       — used when the binding is missing or failing; every call reports "unavailable"
 *
 * Another provider can be added by implementing the same interface. AI output is only ever
 * stored as a *suggestion* (chapter mappings) or as AI_SUPPLEMENTARY practice questions — it is
 * never used for provenance, years, question numbers, official status or PYQ status.
 */
import { getEnv } from "@/db";

export type AIResult<T> = { ok: true; value: T; provider: string } | { ok: false; reason: string };

export interface AIProvider {
  readonly name: string;
  readonly available: boolean;
  /** Returns the model's text reply, or null when the provider can't answer. */
  complete(system: string, prompt: string, opts?: { maxTokens?: number }): Promise<string | null>;
}

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

type WorkersAI = { run: (model: string, input: unknown) => Promise<unknown> };

class WorkersAIProvider implements AIProvider {
  readonly name = "Cloudflare Workers AI";
  readonly available = true;
  constructor(private ai: WorkersAI) {}
  async complete(system: string, prompt: string, opts?: { maxTokens?: number }) {
    try {
      const res = (await this.ai.run(MODEL, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        max_tokens: opts?.maxTokens ?? 512,
        temperature: 0.2,
      })) as { response?: string };
      return typeof res?.response === "string" ? res.response : null;
    } catch {
      return null;
    }
  }
}

class NoAIProvider implements AIProvider {
  readonly name = "None";
  readonly available = false;
  async complete() {
    return null;
  }
}

export async function getAIProvider(): Promise<AIProvider> {
  try {
    const env = (await getEnv()) as CloudflareEnv & { AI?: WorkersAI };
    if (env.AI && typeof env.AI.run === "function") return new WorkersAIProvider(env.AI);
  } catch {
    /* no Cloudflare context */
  }
  return new NoAIProvider();
}

export const AI_UNAVAILABLE =
  "AI assistance isn't available right now. Workers AI runs on the deployed site (it needs the AI binding in wrangler.jsonc); in local development it is off unless EXAMREADY_REMOTE_AI=1 and you are logged in with wrangler. Everything else works without it.";

/** Extracts the first JSON value from a model reply. */
export function parseJsonReply<T>(reply: string | null): T | null {
  if (!reply) return null;
  const start = reply.search(/[[{]/);
  if (start < 0) return null;
  const open = reply[start];
  const close = open === "[" ? "]" : "}";
  const end = reply.lastIndexOf(close);
  if (end <= start) return null;
  try {
    return JSON.parse(reply.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
