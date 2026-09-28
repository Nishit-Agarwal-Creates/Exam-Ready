/**
 * AI-assisted tasks. Each one validates the model's output against known data and returns a
 * clearly-typed suggestion, or an "unavailable" result. Nothing here writes provenance.
 */
import { AI_UNAVAILABLE, getAIProvider, parseJsonReply, type AIResult } from "./provider";

export type ChapterChoice = { id: number; slug: string; name: string };

/** Suggests a chapter. The answer must be one of the given chapters; anything else is discarded. */
export async function aiSuggestChapter(text: string, subjectLabel: string, chapters: ChapterChoice[]): Promise<AIResult<{ chapterId: number; reason: string }>> {
  const ai = await getAIProvider();
  if (!ai.available) return { ok: false, reason: AI_UNAVAILABLE };
  const list = chapters.map((c) => `- ${c.slug}: ${c.name}`).join("\n");
  const reply = await ai.complete(
    "You classify school exam questions into syllabus chapters. Reply with JSON only.",
    `Subject: ${subjectLabel}\nChapters:\n${list}\n\nQuestion:\n${text.slice(0, 2000)}\n\nReply exactly as {"slug": "<one slug from the list>", "reason": "<one short sentence>"}. If no chapter fits, use {"slug": null, "reason": "..."}.`,
    { maxTokens: 120 },
  );
  const parsed = parseJsonReply<{ slug: string | null; reason?: string }>(reply);
  if (!parsed) return { ok: false, reason: "The AI reply couldn't be read. Try again or choose the chapter yourself." };
  const match = chapters.find((c) => c.slug === parsed.slug);
  if (!match) return { ok: false, reason: "The AI didn't pick a chapter from this subject's list, so no suggestion was saved." };
  return { ok: true, value: { chapterId: match.id, reason: String(parsed.reason ?? "").slice(0, 200) }, provider: ai.name };
}

export type GeneratedPractice = { text: string; marks: number; answer: string };

/**
 * Writes new practice questions. They are stored as AI_SUPPLEMENTARY drafts (unpublished) and
 * must be reviewed and published by an editor. They are never PYQs.
 */
export async function aiGeneratePractice(input: {
  subjectLabel: string;
  chapterName: string;
  count: number;
  marks: number;
}): Promise<AIResult<GeneratedPractice[]>> {
  const ai = await getAIProvider();
  if (!ai.available) return { ok: false, reason: AI_UNAVAILABLE };
  const count = Math.min(Math.max(input.count, 1), 5);
  const reply = await ai.complete(
    "You write original school practice questions with model answers. Never claim a question is from a past paper, never mention years, boards' past papers or sources. Reply with JSON only.",
    `Write ${count} original ${input.marks}-mark practice question(s) for ${input.subjectLabel}, chapter "${input.chapterName}". Reply as a JSON array: [{"text": "...", "answer": "..."}].`,
    { maxTokens: 900 },
  );
  const parsed = parseJsonReply<{ text?: string; answer?: string }[]>(reply);
  if (!Array.isArray(parsed)) return { ok: false, reason: "The AI reply couldn't be read. Nothing was saved." };
  const items = parsed
    .filter((p) => typeof p?.text === "string" && p.text.trim().length > 10)
    .slice(0, count)
    .map((p) => ({ text: p.text!.trim().slice(0, 3000), marks: input.marks, answer: String(p.answer ?? "").trim().slice(0, 3000) }));
  if (!items.length) return { ok: false, reason: "The AI didn't return usable questions. Nothing was saved." };
  return { ok: true, value: items, provider: ai.name };
}
