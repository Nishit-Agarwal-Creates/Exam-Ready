import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { getAIProvider } from "@/lib/ai/provider";
import { searchQuestions } from "@/lib/data/questions";
import { getCatalog } from "@/lib/data/taxonomy";
import { aiGeneratePracticeAction } from "../../actions";

export const metadata = { title: "AI assistance" };

export default async function AiPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [ai, catalog, drafts] = await Promise.all([
    getAIProvider(),
    getCatalog(),
    searchQuestions({ sourceType: "AI_SUPPLEMENTARY", published: false, demo: "exclude", pageSize: 1 }, false),
  ]);
  const subjects = catalog.flatMap((b) => b.classes.flatMap((c) => c.subjects.filter((s) => s.chapters.length).map((s) => ({ ...s, label: `${b.name} ${c.name} ${s.name}` }))));
  const subjectId = Number(sp.subject) || subjects[0]?.id;
  const subject = subjects.find((s) => s.id === subjectId);

  return (
    <div>
      <Flash saved={sp.saved} error={sp.error} />
      <h1 className="text-[2rem]">AI assistance</h1>
      <p className="prose-width mt-2 text-pencil">
        AI is optional. It can suggest chapters for imported questions (from each question&apos;s edit page) and draft extra practice questions here. Its output
        is always labelled: suggestions stay suggestions until an editor saves them, and drafts are saved as unpublished AI practice. AI never sets a year,
        source, question number, official status or PYQ status.
      </p>
      <div className={`mt-5 rounded-2xl border p-4 ${ai.available ? "border-verified/40 bg-verified-soft/60" : "border-dashed border-rule-strong bg-desk"}`}>
        <p className="font-bold">{ai.available ? `Provider: ${ai.name}` : "No AI provider is available"}</p>
        <p className="mt-1 text-[0.95rem] text-pencil">
          {ai.available
            ? "Cloudflare Workers AI through the AI binding. It uses the free daily allowance and needs no API key."
            : "Workers AI runs on the deployed site through the AI binding in wrangler.jsonc. In local development it's off unless EXAMREADY_REMOTE_AI=1 and you're logged in with wrangler. Everything else works without it."}
        </p>
      </div>

      <form action={aiGeneratePracticeAction} className="panel mt-6 grid gap-4 rounded-2xl p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="ai-subject" className="field-label">
            Subject
          </label>
          <select id="ai-subject" name="subjectId" className="select" defaultValue={subjectId}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="field-hint mt-1">
            Changing the subject?{" "}
            <Link href="/admin/ai" className="link">
              Reload the chapter list
            </Link>{" "}
            with <code>?subject=id</code>.
          </p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ai-chapter" className="field-label">
            Chapter
          </label>
          <select id="ai-chapter" name="chapterId" className="select" required>
            {subject?.chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ai-count" className="field-label">
            How many
          </label>
          <select id="ai-count" name="count" className="select" defaultValue="3">
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ai-marks" className="field-label">
            Marks each
          </label>
          <select id="ai-marks" name="marks" className="select" defaultValue="2">
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end sm:col-span-2">
          <button type="submit" className="btn btn-primary" disabled={!ai.available}>
            Draft AI practice questions
          </button>
        </div>
      </form>

      <p className="mt-6">
        <Link href="/admin/questions?source=AI_SUPPLEMENTARY&demo=exclude" className="link font-bold">
          Review AI practice drafts ({drafts.total} unpublished)
        </Link>
      </p>
    </div>
  );
}
