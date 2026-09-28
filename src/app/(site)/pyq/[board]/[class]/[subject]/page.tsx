import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PyqListing } from "@/components/pyq-listing";
import { getChapterCoverage, getSubjectCoverage } from "@/lib/data/coverage";
import { searchQuestions } from "@/lib/data/questions";
import { getSubject } from "@/lib/data/taxonomy";
import { examYear, one, type SearchParams } from "@/lib/filters";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ board: string; class: string; subject: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const p = await params;
  const sp = await searchParams;
  const ctx = await getSubject(p.board, p.class, p.subject);
  if (!ctx) return { title: "Not found", robots: { index: false } };
  const cov = (await getSubjectCoverage()).find((r) => r.subjectId === ctx.subject.id);
  const name = `${ctx.board.name} ${ctx.cls.name} ${ctx.subject.name}`;
  const years = cov?.years ?? [];
  return pageMetadata({
    title: `${name} previous-year questions (PYQs)${years.length > 1 ? ` ${years[years.length - 1]}–${years[0]}` : years.length ? ` ${years[0]}` : ""}`,
    description: `${cov?.verifiedPyq ?? 0} verified ${name} previous-year questions from official board papers${years.length ? ` (${years.join(", ")})` : ""}, chapter-wise, with the official marking-scheme answer where published.`,
    path: `/pyq/${p.board}/${p.class}/${p.subject}`,
    // Empty hubs and filtered or paginated views stay out of the index.
    noindex: !cov?.verifiedPyq || Boolean(one(sp.page) || one(sp.year)),
  });
}

export default async function PyqSubject({ params, searchParams }: Props) {
  const p = await params;
  const sp = await searchParams;
  const ctx = await getSubject(p.board, p.class, p.subject);
  if (!ctx) notFound();
  const { board, cls, subject } = ctx;
  const name = `${board.name} ${cls.name} ${subject.name}`;
  const year = examYear(one(sp.year));
  const page = Math.max(1, Math.floor(Number(one(sp.page))) || 1);
  const [cov, chapters, result] = await Promise.all([
    getSubjectCoverage().then((rows) => rows.find((r) => r.subjectId === subject.id)),
    getChapterCoverage(subject.id),
    searchQuestions({ subjectId: subject.id, realPyqOnly: true, groupOnce: true, publicOnly: true, demo: "exclude", year, sort: "recent", page, pageSize: 10 }, true, { cachedIds: true }),
  ]);
  const basePath = `/pyq/${board.slug}/${cls.slug}/${subject.slug}`;
  return (
    <div className="container-page page-enter py-8 sm:py-12">
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Previous-year questions", path: "/pyq" },
          { name: board.name, path: `/pyq/${board.slug}` },
          { name: cls.name, path: `/pyq/${board.slug}/${cls.slug}` },
          { name: subject.name, path: basePath },
        ]}
      />
      <h1 className="text-[2.2rem] sm:text-[2.8rem]">{name} previous-year questions</h1>
      <p className="prose-width mt-3 text-[1.08rem] text-pencil">
        Only questions checked against a stored {board.name} board paper appear here, each with its paper, year, question number and page. The same
        question in several sets of one year counts once.{" "}
        <Link href={`/${board.slug}/${cls.slug}/${subject.slug}`} className="link">
          Subject overview
        </Link>
      </p>
      <PyqListing basePath={basePath} subjectId={subject.id} coverage={cov} chapters={chapters} result={result} year={year} />
    </div>
  );
}
