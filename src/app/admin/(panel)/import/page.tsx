import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { listImportBatches, listPapers } from "@/lib/data/admin";
import { getCatalog } from "@/lib/data/taxonomy";
import { createImportAction } from "../../actions";

export const metadata = { title: "Import questions" };

const EXAMPLE = `SECTION A
1. Define atomicity. [1]
2. Write the balanced equation for the reaction of sodium with water. [2]
SECTION B
3. (a) State Charles' law. [2]
   (b) A gas occupies 300 cm³ at 27 °C. Find its volume at 127 °C at constant pressure. [3]`;

export default async function ImportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [batches, catalog, papers] = await Promise.all([listImportBatches(), getCatalog(), listPapers()]);
  const subjects = catalog.flatMap((b) => b.classes.flatMap((c) => c.subjects.map((s) => ({ id: s.id, label: `${b.name} ${c.name} ${s.name}` }))));
  const realPapers = papers.filter((p) => !p.paper.isDemo);

  return (
    <div>
      <Flash saved={sp.saved} error={sp.error} />
      <h1 className="text-[2rem]">Import questions</h1>
      <ol className="prose-width mt-3 list-decimal space-y-1 pl-5 text-pencil">
        <li>Paste the text of a paper. Questions, sections and marks are picked out automatically.</li>
        <li>Each item is checked for duplicates and given a suggested chapter.</li>
        <li>You review every item. Nothing is published, and nothing becomes verified, without your decision.</li>
      </ol>
      <p className="prose-width mt-2 text-[0.95rem] text-pencil">
        The importer never guesses a year or source. Provenance comes only from the source paper you choose here.
      </p>

      <div className="mt-6 grid gap-8 xl:grid-cols-[1fr_24rem]">
        <form action={createImportAction} className="panel space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="i-subject" className="field-label">
                Subject
              </label>
              <select id="i-subject" name="subjectId" className="select" required defaultValue="">
                <option value="">Choose</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="i-paper" className="field-label">
                Source paper (optional)
              </label>
              <select id="i-paper" name="paperId" className="select" defaultValue="">
                <option value="">None, questions are contributed</option>
                {realPapers.map(({ paper: p, cls, subject }) => (
                  <option key={p.id} value={p.id}>
                    {cls} {subject}: {p.title}
                  </option>
                ))}
              </select>
              <p className="field-hint mt-1">
                Not listed?{" "}
                <Link href="/admin/papers" className="link">
                  Add the paper first
                </Link>
                .
              </p>
            </div>
          </div>
          <div>
            <label htmlFor="i-title" className="field-label">
              Batch name
            </label>
            <input id="i-title" name="title" className="input" placeholder="e.g. ICSE 2024 Chemistry, Section A" />
          </div>
          <div>
            <label htmlFor="i-text" className="field-label">
              Paper text
            </label>
            <textarea id="i-text" name="rawText" className="textarea font-serif" rows={14} required placeholder={EXAMPLE} />
            <p className="field-hint mt-1">Start each question on a new line with its number, like “1.”, “Q2)” or “Question 3:”. Marks in [ ] or ( ) are read.</p>
          </div>
          <button type="submit" className="btn btn-primary">
            Extract questions for review
          </button>
        </form>

        <section aria-labelledby="batches-title">
          <h2 id="batches-title" className="font-sans text-[1.1rem] font-bold">
            Import batches
          </h2>
          {batches.length === 0 ? (
            <p className="mt-2 text-pencil">No imports yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {batches.map(({ batch, subject, cls, pending, total }) => (
                <li key={batch.id}>
                  <Link href={`/admin/import/${batch.id}`} className="panel block p-3 hover:border-ink">
                    <strong>{batch.title}</strong>
                    <span className="block text-sm text-pencil">
                      {cls} {subject}, {Number(pending)} of {Number(total)} awaiting review
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
