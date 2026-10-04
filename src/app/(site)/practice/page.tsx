import type { Metadata } from "next";
import { GeneratorForm, type Availability } from "@/components/generator-form";
import { PAPER_MODES, type PaperMode } from "@/db/schema";
import { getAllCoverage } from "@/lib/data/trends";
import { getCatalog } from "@/lib/data/taxonomy";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Build a practice paper",
  description:
    "Create an ICSE or CBSE practice paper for Classes 6 to 12. Choose chapters, marks, time and mode, and see how many verified previous-year questions exist before you start.",
  path: "/practice",
});

export default async function PracticePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const [catalog, coverage] = await Promise.all([getCatalog(), getAllCoverage()]);
  const availability: Availability = Object.fromEntries(
    coverage.map((r) => [r.subjectId, { verified: r.verified, pending: r.pending, authentic: r.authentic, ai: r.aiPractice, years: r.years }]),
  );
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const subjectId = Number(one(sp.subject)) || undefined;
  const chapterIds = ([] as string[])
    .concat(sp.chapter ?? [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  const mode = one(sp.mode);

  return (
    <div className="container-page page-enter py-8 sm:py-12">
      <header className="max-w-3xl">
        <h1 className="text-[2.2rem] sm:text-[2.8rem]">Build a practice paper</h1>
        <p className="mt-3 text-[1.08rem] text-pencil">
          Choose what to practise. Before anything is built you&apos;ll see how many verified previous-year questions exist for your selection, year by
          year, and what share of the paper will come from them.
        </p>
      </header>
      <GeneratorForm
        catalog={catalog}
        initial={{
          subjectId,
          chapterIds,
          mode: (PAPER_MODES as readonly string[]).includes(mode ?? "") ? (mode as PaperMode) : undefined,
        }}
        availability={availability}
      />
    </div>
  );
}
