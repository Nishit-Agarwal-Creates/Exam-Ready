import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { getSubjectCoverage } from "@/lib/data/coverage";
import { pageMetadata } from "@/lib/site";
import { PyqSubjectList } from "../../pyq-index";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ board: string; class: string }> };

async function load(board: string, cls: string) {
  return (await getSubjectCoverage()).filter((r) => r.boardSlug === board && r.classSlug === cls);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const rows = await load(p.board, p.class);
  if (!rows.length) return { title: "Not found", robots: { index: false } };
  const name = `${rows[0].boardName} ${rows[0].className}`;
  return pageMetadata({
    title: `${name} previous-year questions`,
    description: `Verified ${name} previous-year board exam questions by subject, each linked to its official source paper.`,
    path: `/pyq/${p.board}/${p.class}`,
    noindex: !rows.some((r) => r.verifiedPyq > 0),
  });
}

export default async function PyqClass({ params }: Props) {
  const p = await params;
  const rows = await load(p.board, p.class);
  if (!rows.length) notFound();
  const { boardName, className } = rows[0];
  return (
    <div className="container-page page-enter py-8 sm:py-12">
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Previous-year questions", path: "/pyq" },
          { name: boardName, path: `/pyq/${p.board}` },
          { name: className, path: `/pyq/${p.board}/${p.class}` },
        ]}
      />
      <h1 className="text-[2.2rem] sm:text-[2.8rem]">
        {boardName} {className} previous-year questions
      </h1>
      <PyqSubjectList rows={rows} />
    </div>
  );
}
