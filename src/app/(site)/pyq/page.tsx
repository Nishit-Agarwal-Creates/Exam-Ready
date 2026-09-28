import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { getBankTotals, getSubjectCoverage } from "@/lib/data/coverage";
import { pageMetadata } from "@/lib/site";
import { PyqSubjectList } from "./pyq-index";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "ICSE and CBSE previous-year questions (PYQs)",
  description:
    "Previous-year board exam questions for ICSE and CBSE, each checked against the official paper and linked to its source. Browse by board, class, subject and chapter.",
  path: "/pyq",
});

export default async function PyqHub() {
  const [rows, totals] = await Promise.all([getSubjectCoverage(), getBankTotals()]);
  // Only subjects with board-exam material (verified or awaiting review) are listed here.
  const listed = rows.filter((r) => r.verifiedPyq > 0 || r.sourcePapers.boardExam > 0);
  const boards = [...new Map(rows.map((r) => [r.boardSlug, r.boardName])).entries()];
  return (
    <div className="container-page page-enter py-8 sm:py-12">
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Previous-year questions", path: "/pyq" },
        ]}
      />
      <header className="max-w-3xl">
        <h1 className="text-[2.2rem] sm:text-[2.8rem]">Previous-year questions</h1>
        <p className="mt-3 text-[1.08rem] text-pencil">
          Questions from official board exam papers. Each one is listed only after an editor has checked it against the official document, and it links
          to that document with its year, paper code, question number and page.
        </p>
        <p className="mt-3 text-[0.98rem]">
          <strong className="num">{totals.verifiedPyq}</strong> verified PYQs published, <strong className="num">{totals.awaitingPyq}</strong> board-exam
          questions awaiting review.{" "}
          <Link href="/coverage" className="link">
            See full coverage
          </Link>
        </p>
      </header>
      {boards.map(([slug, name]) => {
        const list = listed.filter((r) => r.boardSlug === slug);
        return (
          <section key={slug} aria-labelledby={`pyq-${slug}`} className="mt-10">
            <h2 id={`pyq-${slug}`} className="text-[1.7rem]">
              <Link href={`/pyq/${slug}`} className="hover:underline">
                {name}
              </Link>
            </h2>
            {list.length ? (
              <PyqSubjectList rows={list} />
            ) : (
              <p className="panel mt-4 rounded-2xl p-5 text-pencil">
                No {name} board exam papers are in the bank yet. Official specimen papers are counted under{" "}
                <Link href={`/coverage?board=${slug}`} className="link">
                  coverage
                </Link>
                .
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
