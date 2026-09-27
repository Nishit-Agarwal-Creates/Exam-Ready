import type { Metadata } from "next";
import { GeneratorForm } from "@/components/generator-form";
import { getCatalog } from "@/lib/data/taxonomy";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Build a practice paper",
  description:
    "Create an ICSE practice paper for Class 8, 9 or 10. Choose chapters, marks and time, and see how many verified previous-year questions it will use before you start.",
  path: "/practice",
});

export default async function PracticePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const catalog = await getCatalog();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const subjectId = Number(one(sp.subject)) || undefined;
  const chapterIds = ([] as string[])
    .concat(sp.chapter ?? [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  const mode = one(sp.mode);

  return (
    <div className="container-page py-8 sm:py-12">
      <header className="max-w-3xl">
        <h1 className="text-[2.2rem] sm:text-[2.8rem]">Build a practice paper</h1>
        <p className="mt-3 text-[1.08rem] text-pencil">
          Choose what to practise. Before the paper is built you&apos;ll see how many reviewed questions are available and how much of it comes from verified
          past papers.
        </p>
      </header>
      <GeneratorForm
        catalog={catalog}
        initial={{
          subjectId,
          chapterIds,
          mode: mode === "PYQ_ONLY" || mode === "PYQ_PRIORITY" || mode === "EXAM_SIMULATION" ? mode : undefined,
        }}
      />
    </div>
  );
}
