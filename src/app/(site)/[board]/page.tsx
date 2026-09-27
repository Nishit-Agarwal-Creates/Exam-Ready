import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
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
    description: `Practise ${board.name} Classes 8, 9 and 10 with custom papers built from verified previous questions. Chapter-wise questions for Maths, Physics, Chemistry and Biology.`,
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

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
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
