import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { QuestionBlock } from "@/components/question-block";
import { getDb, schema } from "@/db";
import { searchQuestions } from "@/lib/data/questions";
import { AUTHORITY_LABELS, PAPER_TYPE_LABELS } from "@/lib/provenance";
import { Pagination } from "@/components/pagination";
import { one, type SearchParams } from "@/lib/filters";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

/** Pack notes carry "Usage: …" and "Accessed YYYY-MM-DD." at the end; show them as their own rows. */
function splitNotes(notes: string) {
  const accessed = notes.match(/Accessed (\d{4}-\d{2}-\d{2})\.?/)?.[1] ?? null;
  const usageMatch = notes.match(/Usage: (.*?)(?= Accessed \d{4}-|$)/);
  const body = notes.replace(/ ?Usage: .*?(?= Accessed \d{4}-|$)/, "").replace(/ ?Accessed \d{4}-\d{2}-\d{2}\.?/, "").trim();
  return { body, usage: usageMatch?.[1]?.trim() ?? null, accessed };
}

async function load(idStr: string) {
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return null;
  const db = await getDb();
  const [row] = await db
    .select({ paper: schema.papers, board: schema.boards.name, boardSlug: schema.boards.slug, cls: schema.classes.name, classSlug: schema.classes.slug, subject: schema.subjects.name, subjectSlug: schema.subjects.slug })
    .from(schema.papers)
    .innerJoin(schema.boards, eq(schema.papers.boardId, schema.boards.id))
    .innerJoin(schema.classes, eq(schema.papers.classId, schema.classes.id))
    .innerJoin(schema.subjects, eq(schema.papers.subjectId, schema.subjects.id))
    .where(eq(schema.papers.id, id));
  if (!row || row.paper.isDemo) return null;
  return row;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const row = await load((await params).id);
  if (!row) return { title: "Source not found", robots: { index: false } };
  return pageMetadata({
    title: row.paper.title,
    description: `Source record for ${row.paper.title}: origin, extraction method and which of its questions have been verified.`,
    path: `/sources/${row.paper.id}`,
    noindex: row.paper.status === "REJECTED",
  });
}

export default async function SourcePage({ params, searchParams }: Props) {
  const row = await load((await params).id);
  if (!row) notFound();
  const p = row.paper;
  const page = Math.max(1, Math.floor(Number(one((await searchParams).page))) || 1);
  const [all, published] = await Promise.all([
    searchQuestions({ paperId: p.id, pageSize: 1 }, false, { light: true }),
    searchQuestions(
      { paperId: p.id, publicOnly: true, realPyqOnly: p.paperType === "BOARD_EXAM" ? true : undefined, sort: "paper", page, pageSize: 12 },
      false,
    ),
  ]);
  const notes = splitNotes(p.sourceNotes ?? "");
  const meta: [string, string | null][] = [
    ["Board", row.board],
    ["Class", row.cls],
    ["Subject", row.subject],
    ["Exam year", p.year ? String(p.year) : null],
    ["Session", p.examSession],
    ["Paper", p.paperName],
    ["Q.P. code", p.paperCode],
    ["Set", p.setCode],
    ["Series", p.seriesCode],
    ["Language", p.language],
    ["Type", PAPER_TYPE_LABELS[p.paperType]],
    ["Authority", `${AUTHORITY_LABELS[p.authority]}${p.authorityName ? `: ${p.authorityName}` : ""}`],
    ["Pages", p.pageCount ? String(p.pageCount) : null],
    ["Maximum marks", p.maxMarks ? String(p.maxMarks) : null],
    ["Time", p.durationMinutes ? `${p.durationMinutes} minutes` : null],
    ["Extraction", p.extractionMethod ? `${p.extractionMethod === "PDF_TEXT_LAYER" ? "Text layer of the PDF" : p.extractionMethod === "OCR" ? "OCR" : p.extractionMethod === "MANUAL" ? "Typed manually" : "Pasted text"}${p.extractionTool ? ` (${p.extractionTool})` : ""}` : null],
    ["OCR confidence", p.ocrUsed && p.ocrConfidence !== null ? `${Math.round(p.ocrConfidence)}%` : null],
    ["File checksum", p.sha256 ? `SHA-256 ${p.sha256.slice(0, 16)}…` : null],
    ["Questions imported", String(all.total)],
    ["Usage", notes.usage],
    ["Accessed", notes.accessed ? new Date(notes.accessed).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : null],
    ["Added", new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })],
  ];

  return (
    <div className="container-page page-enter py-8 sm:py-12">
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Sources", path: "/sources" },
          { name: p.paperCode ?? p.title, path: `/sources/${p.id}` },
        ]}
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div>
          <h1 className="text-[1.9rem] sm:text-[2.4rem]">{p.title}</h1>
          <dl className="sheet mt-6 grid gap-x-6 gap-y-2 p-5 sm:grid-cols-[auto_1fr]">
            {meta
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-pencil">{k}</dt>
                  <dd className="font-bold">{v}</dd>
                </div>
              ))}
          </dl>
          {notes.body && <p className="prose-width mt-4 text-[0.95rem] text-pencil">{notes.body}</p>}
        </div>
        <aside className="space-y-4">
          <div className="sheet p-5">
            <h2 className="font-sans text-[1.05rem] font-bold">Verification</h2>
            <p className="mt-2 font-serif text-[2rem] font-semibold num">
              {published.total}
              <span className="font-sans text-[1rem] font-normal text-pencil"> of {all.total} verified</span>
            </p>
            <p className="text-[0.92rem] text-pencil">
              {all.total - published.total > 0
                ? `${all.total - published.total} extracted questions are still waiting for an editor to check them against this document.`
                : "Every extracted question has been reviewed."}
            </p>
          </div>
          {p.sourceUrl && (
            <div className="sheet p-5 text-[0.95rem]">
              <h2 className="font-sans text-[1.05rem] font-bold">Original document</h2>
              <a href={p.sourceUrl} className="link mt-2 block break-all" rel="noopener noreferrer nofollow" target="_blank">
                {p.sourceUrl}
              </a>
              {p.sourceFile && <p className="mt-1 text-pencil">File inside the archive: {p.sourceFile}</p>}
              {p.answerSourceUrl && (
                <>
                  <h3 className="mt-4 font-bold">Official answers</h3>
                  <a href={p.answerSourceUrl} className="link block break-all" rel="noopener noreferrer nofollow" target="_blank">
                    {p.answerSourceUrl}
                  </a>
                  {p.answerSourceFile && <p className="mt-1 text-pencil">File: {p.answerSourceFile}</p>}
                </>
              )}
              <p className="mt-3 text-[0.85rem] text-pencil">Links go to the publisher. ExamReady isn&apos;t affiliated with or endorsed by any board.</p>
            </div>
          )}
          <Link href={`/pyq/${row.boardSlug}/${row.classSlug}/${row.subjectSlug}`} className="btn btn-secondary w-full">
            {row.subject} previous-year questions
          </Link>
        </aside>
      </div>

      <section className="mt-10" aria-labelledby="qs-title">
        <h2 id="qs-title" className="text-[1.6rem]">
          {p.paperType === "BOARD_EXAM" ? "Verified questions from this paper" : "Verified questions from this document"}
        </h2>
        {published.items.length === 0 ? (
          <p className="panel mt-4 rounded-2xl p-6 text-pencil">None yet. Questions appear here once an editor has verified them.</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {published.items.map((q) => {
              const link = q.sources.find((s) => s.paperId === p.id);
              return (
                <li key={q.id} className="sheet p-4 sm:p-6">
                  <QuestionBlock number={`${link?.questionNumber ?? "?"}${link?.part ?? ""}`} q={q} headingLevel={3} provenance="line" />
                </li>
              );
            })}
          </ol>
        )}
        <Pagination page={published.page} pages={published.pages} href={(n) => `/sources/${p.id}${n > 1 ? `?page=${n}` : ""}`} />
      </section>
    </div>
  );
}
