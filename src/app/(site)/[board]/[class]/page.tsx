import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SubjectGlyph } from "@/components/subject-glyph";
import { getSubjectCoverage, publishedTotal, type SubjectCoverage } from "@/lib/data/coverage";
import { getCatalog, getClass } from "@/lib/data/taxonomy";
import { classExamNote } from "@/lib/exam-info";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ board: string; class: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const ctx = await getClass(p.board, p.class);
  if (!ctx) return { title: "Not found", robots: { index: false } };
  const name = `${ctx.board.name} ${ctx.cls.name}`;
  return pageMetadata({
    title: `${name} practice papers, chapter-wise questions and PYQs`,
    description: `${name}: subjects, chapter lists, verified previous-year question coverage, and custom practice papers you can take online or download as PDF.`,
    path: `/${ctx.board.slug}/${ctx.cls.slug}`,
    noindex: !(await classHasContent(ctx.cls.id)),
  });
}

export default async function ClassPage({ params }: Props) {
  const p = await params;
  const ctx = await getClass(p.board, p.class);
  if (!ctx) notFound();
  const { board, cls } = ctx;
  const catalog = await getCatalog();
  const subjects = catalog.find((b) => b.id === board.id)?.classes.find((c) => c.id === cls.id)?.subjects ?? [];
  const coverage = await getSubjectCoverage();
  const stats = subjects.map((s) => ({ s, t: coverage.find((r) => r.subjectId === s.id) }));

  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: board.name, path: `/${board.slug}` },
          { name: cls.name, path: `/${board.slug}/${cls.slug}` },
        ]}
      />
      <header className="max-w-3xl">
        <h1 className="text-[2.2rem] sm:text-[2.8rem]">
          {board.name} {cls.name} practice papers
        </h1>
        <p className="prose-width mt-4 text-[1.08rem] text-pencil">{classExamNote(board.slug, cls.level)}</p>
      </header>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {stats.map(({ s, t }, i) => (
          <section key={s.id} className="glyph-host sheet fx-lift p-5 sm:p-6" aria-labelledby={`s-${s.id}`} data-reveal style={{ ["--d" as string]: `${i * 60}ms` }}>
            <div className="flex items-start gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-ink-line bg-ink-soft text-ink">
                <SubjectGlyph slug={s.slug} />
              </span>
              <div className="min-w-0">
                <h2 id={`s-${s.id}`} className="text-[1.6rem]">
                  <Link href={`/${board.slug}/${cls.slug}/${s.slug}`} className="hover:underline">
                    {cls.name} {s.name}
                  </Link>
                </h2>
                <p className="mt-1 text-[0.92rem] text-pencil">{s.chapters.length ? `${s.chapters.length} chapters` : "Chapter list not added yet"}</p>
              </div>
            </div>
            <Availability t={t} />
            {s.chapters.length > 0 && <p className="mt-3 line-clamp-2 text-[0.95rem] text-pencil">{s.chapters.map((c) => c.name).join(", ")}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/practice?subject=${s.id}`} className="btn btn-primary btn-sm" data-fx="pulse">
                Build a {s.name} paper
              </Link>
              {s.chapters.length > 0 && (
                <Link href={`/${board.slug}/${cls.slug}/${s.slug}/chapter-wise`} className="btn btn-secondary btn-sm">
                  Chapter-wise questions
                </Link>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Availability({ t }: { t?: SubjectCoverage }) {
  if (!t || (!publishedTotal(t) && !t.awaitingReview)) {
    return <p className="mt-4 rounded-xl border border-dashed border-rule-strong px-3 py-2 text-[0.92rem] text-pencil">Source collection in progress. No questions published yet.</p>;
  }
  const items: [string, number, string][] = [
    ["Verified PYQs", t.verifiedPyq, "text-verified"],
    ["Official sample", t.officialSample, "text-official"],
    ["AI practice", t.aiPractice, "text-ai"],
    ["Awaiting review", t.awaitingReview, "text-pending"],
  ];
  return (
    <dl className="mt-4 grid grid-cols-4 gap-2 border-y border-rule py-3">
      {items.map(([label, n, cls]) => (
        <div key={label}>
          <dt className="text-[0.78rem] leading-tight text-pencil">{label}</dt>
          <dd className={`num font-serif text-[1.35rem] font-semibold ${n ? cls : "text-pencil/50"}`}>{n}</dd>
        </div>
      ))}
    </dl>
  );
}

async function classHasContent(classId: number): Promise<boolean> {
  const rows = await getSubjectCoverage();
  return rows.some((r) => r.classId === classId && (r.chapterCount > 0 || publishedTotal(r) > 0));
}
