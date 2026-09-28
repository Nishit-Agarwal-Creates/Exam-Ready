import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { SubjectNav } from "@/components/subject-nav";
import { CoveragePanel, TrendsPanel } from "@/components/coverage-panels";
import { getSubjectCoverage as getAllSubjectCoverage, getSubjectYearCoverage, publishedTotal } from "@/lib/data/coverage";
import { getSubjectTrends } from "@/lib/data/trends";
import { loadSubjectPage, subjectMetaContext } from "@/lib/data/seo";
import { subjectExamNote } from "@/lib/exam-info";
import { absoluteUrl, pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ board: string; class: string; subject: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = await subjectMetaContext(await params);
  if (!m) return { title: "Not found", robots: { index: false } };
  const cov = (await getAllSubjectCoverage()).find((r) => r.subjectId === m.ctx.subject.id);
  return pageMetadata({
    title: `${m.name}: chapters, previous-year questions and practice papers`,
    description: m.ctx.chapters.length
      ? `All ${m.ctx.chapters.length} chapters of ${m.name}, with verified previous-year question coverage by year. Build a practice paper, take it online, or download a PDF.`
      : `${m.name} on ExamReady: current question coverage and practice options.`,
    path: m.base,
    // Pages with no chapters and no questions would be thin; keep them out of search results.
    noindex: m.ctx.chapters.length === 0 && !(cov && publishedTotal(cov) > 0),
  });
}

export default async function SubjectPage({ params }: Props) {
  const d = await loadSubjectPage(await params);
  const { subject, chapters, stats, totals, base, name } = d;
  const [coverage, trends] = await Promise.all([getSubjectYearCoverage(subject.id), getSubjectTrends(subject.id)]);

  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs items={d.crumbs} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${name} chapters`,
          itemListElement: chapters.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, url: absoluteUrl(`${base}/${c.slug}`) })),
        }}
      />
      <header className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-end">
        <div>
          <h1 className="text-[2.2rem] sm:text-[2.8rem]">{name}</h1>
          <p className="prose-width mt-4 text-[1.08rem]">
            {subject.overview || `The chapter list and questions for ${name} haven't been added yet. Coverage below updates as official sources are imported and verified.`}
          </p>
        </div>
        <div className="sheet p-5">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-sm text-pencil">Questions</dt>
              <dd className="num font-serif text-[1.6rem] font-semibold">{totals.total}</dd>
            </div>
            <div>
              <dt className="text-sm text-pencil">Verified PYQs</dt>
              <dd className="num font-serif text-[1.6rem] font-semibold">{totals.realVerifiedPyq}</dd>
            </div>
          </dl>
          {totals.demo > 0 && <p className="mt-2 text-sm text-demo">{totals.demo} questions are demo data, not real past-paper questions.</p>}
          <Link href={`/practice?subject=${subject.id}`} className="btn btn-primary mt-4 w-full">
            Build a {subject.name} paper
          </Link>
        </div>
      </header>

      <SubjectNav base={base} current="overview" />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <CoveragePanel byYear={coverage.byYear} verified={coverage.verifiedPyqs} pending={coverage.pendingPyqs} pyqHref={`/pyqs?subject=${subject.id}`} />
        <TrendsPanel trends={trends} />
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="chapters-title">
          <h2 id="chapters-title" className="text-[1.7rem]">
            Chapters
          </h2>
          {chapters.length === 0 && <p className="mt-4 text-pencil">The chapter list for this subject hasn&apos;t been added yet.</p>}
          <ol className="mt-4 divide-y divide-rule border-y border-rule">
            {chapters.map((c, i) => {
              const s = stats.get(c.id);
              return (
                <li key={c.id} className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-2 py-3">
                  <span className="num font-serif text-pencil">{i + 1}.</span>
                  <span>
                    <Link href={`${base}/${c.slug}`} className="font-bold hover:text-ink hover:underline">
                      {c.name}
                    </Link>
                    <span className="block text-[0.93rem] text-pencil">{c.topics.map((t) => t.name).join(", ")}</span>
                  </span>
                  <span className="num whitespace-nowrap text-sm text-pencil">{s?.total ?? 0} Q</span>
                </li>
              );
            })}
          </ol>
        </section>
        <div className="space-y-8">
          <section aria-labelledby="exam-title">
            <h2 id="exam-title" className="text-[1.5rem]">
              How this subject is examined
            </h2>
            <p className="mt-3 text-pencil">{subjectExamNote(d.board.slug, d.cls.level, subject.slug)}</p>
          </section>
          {subject.studyTips.length > 0 && (
            <section aria-labelledby="tips-title">
              <h2 id="tips-title" className="text-[1.5rem]">
                Study tips
              </h2>
              <ul className="mt-3 space-y-3">
                {subject.studyTips.map((t) => (
                  <li key={t} className="border-l-2 border-margin/60 pl-4">
                    {t}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
