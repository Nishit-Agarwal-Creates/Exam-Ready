import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog } from "@/lib/data/taxonomy";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Subjects",
  description: "Every board, class and subject on ExamReady, with links to chapter lists, previous-year questions and practice papers.",
  path: "/subjects",
});

export default async function SubjectsPage() {
  const catalog = await getCatalog();
  return (
    <div className="container-page py-8 sm:py-12">
      <h1 className="text-[2.2rem] sm:text-[2.8rem]">Subjects</h1>
      <p className="prose-width mt-3 text-[1.08rem] text-pencil">Choose a subject to see its chapters, available questions and practice options.</p>
      {catalog.map((b) => (
        <section key={b.id} className="mt-10" aria-labelledby={`b-${b.id}`}>
          <h2 id={`b-${b.id}`} className="text-[1.8rem]">
            <Link href={`/${b.slug}`} className="hover:underline">
              {b.name}
            </Link>
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[...b.classes].reverse().map((c) => (
              <div key={c.id} className="sheet p-5">
                <h3 className="text-[1.35rem]">
                  <Link href={`/${b.slug}/${c.slug}`} className="hover:underline">
                    {c.name}
                  </Link>
                </h3>
                <ul className="mt-3 divide-y divide-rule border-t border-rule">
                  {c.subjects.map((s) => (
                    <li key={s.id}>
                      <Link href={`/${b.slug}/${c.slug}/${s.slug}`} className="flex min-h-11 items-center justify-between gap-2 py-2 font-bold hover:text-ink">
                        {s.name}
                        <span className="text-sm font-normal text-pencil">{s.chapters.length} chapters</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
      <section className="mt-10 rounded-md border border-dashed border-rule-strong p-5">
        <h2 className="font-sans text-[1.1rem] font-bold">More boards are planned</h2>
        <p className="mt-1 text-pencil">CBSE, state boards and foundation courses will be added once verified questions for them are ready.</p>
      </section>
    </div>
  );
}
