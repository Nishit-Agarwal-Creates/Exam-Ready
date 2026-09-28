import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { classExamNote } from "@/lib/exam-info";
import { getCatalog, getClass, getSubjectStats, sumStats } from "@/lib/data/taxonomy";
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
  const stats = await Promise.all(subjects.map(async (s) => ({ s, t: sumStats(await getSubjectStats(s.id)) })));

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
        {stats.map(({ s, t }) => (
          <section key={s.id} className="sheet p-5 sm:p-6" aria-labelledby={`s-${s.id}`}>
            <h2 id={`s-${s.id}`} className="text-[1.6rem]">
              <Link href={`/${board.slug}/${cls.slug}/${s.slug}`} className="hover:underline">
                {cls.name} {s.name}
              </Link>
            </h2>
            <dl className="mt-3 grid grid-cols-3 gap-3 border-y border-rule py-3">
              <div>
                <dt className="text-sm text-pencil">Chapters</dt>
                <dd className="num font-serif text-[1.4rem] font-semibold">{s.chapters.length}</dd>
              </div>
              <div>
                <dt className="text-sm text-pencil">Questions</dt>
                <dd className="num font-serif text-[1.4rem] font-semibold">{t.total}</dd>
              </div>
              <div>
                <dt className="text-sm text-pencil">Verified PYQs</dt>
                <dd className="num font-serif text-[1.4rem] font-semibold">{t.realVerifiedPyq}</dd>
              </div>
            </dl>
            {t.demo > 0 && <p className="mt-2 text-sm text-demo">{t.demo} of these questions are demo data.</p>}
            <p className="mt-3 line-clamp-2 text-[0.95rem] text-pencil">{s.chapters.map((c) => c.name).join(", ")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/practice?subject=${s.id}`} className="btn btn-primary btn-sm">
                Build a {s.name} paper
              </Link>
              <Link href={`/${board.slug}/${cls.slug}/${s.slug}/chapter-wise`} className="btn btn-secondary btn-sm">
                Chapter-wise questions
              </Link>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

async function classHasContent(classId: number): Promise<boolean> {
  const catalog = await getCatalog();
  const subjects = catalog.flatMap((b) => b.classes).find((c) => c.id === classId)?.subjects ?? [];
  for (const s of subjects) {
    if (s.chapters.length) return true;
    if (sumStats(await getSubjectStats(s.id)).total > 0) return true;
  }
  return false;
}
