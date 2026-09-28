import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { getSubjectCoverage } from "@/lib/data/coverage";
import { pageMetadata } from "@/lib/site";
import { PyqSubjectList } from "../pyq-index";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ board: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { board } = await params;
  const rows = (await getSubjectCoverage()).filter((r) => r.boardSlug === board);
  if (!rows.length) return { title: "Not found", robots: { index: false } };
  return pageMetadata({
    title: `${rows[0].boardName} previous-year questions by class and subject`,
    description: `Verified ${rows[0].boardName} previous-year board exam questions, linked to the official papers. Browse by class, subject and chapter.`,
    path: `/pyq/${board}`,
    noindex: !rows.some((r) => r.verifiedPyq > 0),
  });
}

export default async function PyqBoard({ params }: Props) {
  const { board } = await params;
  const rows = (await getSubjectCoverage()).filter((r) => r.boardSlug === board);
  if (!rows.length) notFound();
  const name = rows[0].boardName;
  const classes = [...new Map(rows.map((r) => [r.classSlug, r])).values()];
  return (
    <div className="container-page page-enter py-8 sm:py-12">
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Previous-year questions", path: "/pyq" },
          { name, path: `/pyq/${board}` },
        ]}
      />
      <h1 className="text-[2.2rem] sm:text-[2.8rem]">{name} previous-year questions</h1>
      <p className="mt-3 max-w-3xl text-[1.08rem] text-pencil">Only questions checked against an official {name} board paper are shown as PYQs.</p>
      {classes.map((c) => {
        const list = rows.filter((r) => r.classSlug === c.classSlug && (r.verifiedPyq > 0 || r.sourcePapers.boardExam > 0));
        return (
          <section key={c.classSlug} className="mt-8" aria-labelledby={`c-${c.classSlug}`}>
            <h2 id={`c-${c.classSlug}`} className="text-[1.5rem]">
              <Link href={`/pyq/${board}/${c.classSlug}`} className="hover:underline">
                {c.className}
              </Link>
            </h2>
            {list.length ? <PyqSubjectList rows={list} /> : <p className="mt-2 text-pencil">No board exam papers for this class yet. Source collection is in progress.</p>}
          </section>
        );
      })}
    </div>
  );
}
