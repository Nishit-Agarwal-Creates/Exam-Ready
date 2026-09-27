import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SubjectNav } from "@/components/subject-nav";
import { loadSubjectPage, subjectMetaContext } from "@/lib/data/seo";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ board: string; class: string; subject: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = await subjectMetaContext(await params);
  if (!m) return { title: "Not found", robots: { index: false } };
  return pageMetadata({
    title: `${m.name} chapter-wise questions`,
    description: `Chapter-wise practice for ${m.name}: every chapter with its topics, how many questions are available, and a one-tap practice paper for each.`,
    path: `${m.base}/chapter-wise`,
  });
}

export default async function ChapterWisePage({ params }: Props) {
  const d = await loadSubjectPage(await params);
  const { subject, chapters, stats, base, name } = d;

  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs items={[...d.crumbs, { name: "Chapter-wise", path: `${base}/chapter-wise` }]} />
      <h1 className="text-[2.2rem] sm:text-[2.8rem]">{name} chapter-wise questions</h1>
      <p className="prose-width mt-3 text-[1.08rem] text-pencil">
        Revise one chapter at a time. Each chapter lists its topics and the questions available for practice, split by source.
      </p>
      <SubjectNav base={base} current="chapter-wise" />

      <ol className="mt-8 space-y-4">
        {chapters.map((c, i) => {
          const s = stats.get(c.id);
          const total = s?.total ?? 0;
          const marks = s?.marks ?? 0;
          return (
            <li key={c.id} className="sheet p-5 sm:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <h2 className="text-[1.35rem]">
                    <span className="num mr-2 text-pencil">{i + 1}.</span>
                    <Link href={`${base}/${c.slug}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </h2>
                  {c.summary && <p className="prose-width mt-2 text-pencil">{c.summary}</p>}
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {c.topics.map((t) => (
                      <li key={t.id} className="rounded-md border border-rule bg-desk/60 px-2.5 py-1 text-[0.9rem]">
                        {t.name}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="shrink-0 md:w-56">
                  <p className="text-[0.95rem]">
                    <strong className="num">{total}</strong> questions, <span className="num">{marks}</span> marks
                  </p>
                  <p className="text-sm text-pencil">
                    {s && s.demo > 0 ? `${s.demo} demo` : `${s?.realVerifiedPyq ?? 0} verified PYQs`}
                  </p>
                  {total > 0 ? (
                    <Link href={`/practice?subject=${subject.id}&chapter=${c.id}`} className="btn btn-secondary btn-sm mt-3 w-full">
                      Practise this chapter
                    </Link>
                  ) : (
                    <p className="mt-3 text-sm text-pencil">No questions yet for this chapter.</p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
