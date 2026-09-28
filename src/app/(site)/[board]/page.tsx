import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ClassCard } from "@/components/class-card";
import { getSubjectCoverage } from "@/lib/data/coverage";
import { classExamNote } from "@/lib/exam-info";
import { getBoard, getCatalog } from "@/lib/data/taxonomy";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ board: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { board: slug } = await params;
  const board = await getBoard(slug);
  if (!board) return { title: "Not found", robots: { index: false } };
  return pageMetadata({
    title: `${board.name} practice papers and previous-year questions`,
    description: `${board.name} Classes 6 to 12: verified questions from official ${board.name === "CBSE" ? "board papers, sample papers and question banks" : "specimen papers"}, chapter-wise practice, timed tests and PDFs. Coverage shown honestly for every class.`,
    path: `/${board.slug}`,
  });
}

export default async function BoardPage({ params }: Props) {
  const { board: slug } = await params;
  const board = await getBoard(slug);
  if (!board) notFound();
  const catalog = await getCatalog();
  const entry = catalog.find((b) => b.id === board.id);
  const classes = [...(entry?.classes ?? [])].reverse();
  const coverage = await getSubjectCoverage();
  const card = (c: (typeof classes)[number]) => {
    const rows = coverage.filter((r) => r.classId === c.id);
    return {
      href: `/${board.slug}/${c.slug}`,
      boardSlug: board.slug,
      level: c.level,
      name: c.name,
      sourced: rows.reduce((t, r) => t + r.verifiedPyq + r.officialSample + r.community, 0),
      aiPractice: rows.reduce((t, r) => t + r.aiPractice, 0),
      awaiting: rows.reduce((t, r) => t + r.awaitingReview, 0),
      subjects: c.subjects.map((s) => ({ slug: s.slug, name: s.name })),
    };
  };

  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: board.name, path: `/${board.slug}` },
        ]}
      />
      <header className="max-w-3xl">
        <h1 className="text-[2.2rem] sm:text-[2.8rem]">{board.name} practice papers and previous-year questions</h1>
        <p className="mt-2 font-serif text-[1.15rem] text-pencil">{board.fullName}</p>
        <p className="prose-width mt-4 text-[1.08rem]">{board.description}</p>
      </header>

      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[...classes].reverse().map((c, i) => (
          <li key={c.id} className="expand-in" style={{ ["--d" as string]: `${i * 45}ms` }}>
            <ClassCard c={card(c)} />
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-[1.6rem]">Subjects by class</h2>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {classes.map((c) => (
          <section key={c.id} className="sheet flex flex-col p-5 sm:p-6" aria-labelledby={`c-${c.id}`}>
            <h2 id={`c-${c.id}`} className="text-[1.6rem]">
              <Link href={`/${board.slug}/${c.slug}`} className="hover:underline">
                {board.name} {c.name}
              </Link>
            </h2>
            <p className="mt-2 text-[0.95rem] text-pencil">{classExamNote(board.slug, c.level)}</p>
            <ul className="mt-4 divide-y divide-rule border-y border-rule">
              {c.subjects.map((s) => (
                <li key={s.id}>
                  <Link href={`/${board.slug}/${c.slug}/${s.slug}`} className="flex min-h-11 items-center justify-between gap-3 py-2 hover:text-ink">
                    <span className="font-bold">{s.name}</span>
                    <span className="text-sm text-pencil">{s.chapters.length} chapters</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={`/${board.slug}/${c.slug}`} className="link mt-4 font-bold">
              {c.name} overview
            </Link>
          </section>
        ))}
      </div>
    </div>
  );
}
