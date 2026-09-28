import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PyqListing } from "@/components/pyq-listing";
import { getChapterCoverage } from "@/lib/data/coverage";
import { searchQuestions } from "@/lib/data/questions";
import { getSubject } from "@/lib/data/taxonomy";
import { examYear, one, type SearchParams } from "@/lib/filters";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

type Params = { board: string; class: string; subject: string; chapter: string };
type Props = { params: Promise<Params>; searchParams: Promise<SearchParams> };

async function load(p: Params) {
  const ctx = await getSubject(p.board, p.class, p.subject);
  const chapter = ctx?.chapters.find((c) => c.slug === p.chapter);
  return ctx && chapter ? { ...ctx, chapter } : null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const p = await params;
  const sp = await searchParams;
  const ctx = await load(p);
  if (!ctx) return { title: "Not found", robots: { index: false } };
  const cov = (await getChapterCoverage(ctx.subject.id)).find((c) => c.chapterId === ctx.chapter.id);
  const name = `${ctx.board.name} ${ctx.cls.name} ${ctx.subject.name}`;
  return pageMetadata({
    title: `${ctx.chapter.name}: ${name} previous-year questions`,
    description: `${cov?.verifiedPyq ?? 0} verified previous-year questions on ${ctx.chapter.name} (${name})${cov?.years.length ? ` from ${cov.years.join(", ")}` : ""}, each linked to its official paper.`,
    path: `/pyq/${p.board}/${p.class}/${p.subject}/${p.chapter}`,
    // Thin chapter hubs (fewer than three verified questions) are not indexed.
    noindex: (cov?.verifiedPyq ?? 0) < 3 || Boolean(one(sp.page) || one(sp.year)),
  });
}

export default async function PyqChapter({ params, searchParams }: Props) {
  const p = await params;
  const sp = await searchParams;
  const ctx = await load(p);
  if (!ctx) notFound();
  const { board, cls, subject, chapter } = ctx;
  const year = examYear(one(sp.year));
  const page = Math.max(1, Math.floor(Number(one(sp.page))) || 1);
  const [cov, result] = await Promise.all([
    getChapterCoverage(subject.id).then((rows) => rows.find((c) => c.chapterId === chapter.id)),
    searchQuestions(
      { subjectId: subject.id, chapterId: chapter.id, realPyqOnly: true, groupOnce: true, publicOnly: true, demo: "exclude", year, sort: "recent", page, pageSize: 10 },
      true,
      { cachedIds: true },
    ),
  ]);
  const subjectPath = `/pyq/${board.slug}/${cls.slug}/${subject.slug}`;
  const basePath = `${subjectPath}/${chapter.slug}`;
  return (
    <div className="container-page page-enter py-8 sm:py-12">
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Previous-year questions", path: "/pyq" },
          { name: board.name, path: `/pyq/${board.slug}` },
          { name: cls.name, path: `/pyq/${board.slug}/${cls.slug}` },
          { name: subject.name, path: subjectPath },
          { name: chapter.name, path: basePath },
        ]}
      />
      <h1 className="text-[2.2rem] sm:text-[2.8rem]">{chapter.name}</h1>
      <p className="mt-2 text-[1.1rem] font-bold text-pencil">
        {board.name} {cls.name} {subject.name}: previous-year questions
      </p>
      {chapter.summary && <p className="prose-width mt-3 text-pencil">{chapter.summary}</p>}
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.95rem]">
        <Link href={subjectPath} className="link">
          All {subject.name} PYQs
        </Link>
        <Link href={`/${board.slug}/${cls.slug}/${subject.slug}/${chapter.slug}`} className="link">
          Chapter page
        </Link>
      </p>
      <PyqListing basePath={basePath} subjectId={subject.id} chapterId={chapter.id} coverage={cov} result={result} year={year} />
    </div>
  );
}
