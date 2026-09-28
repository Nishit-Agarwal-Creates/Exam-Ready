import type { Metadata } from "next";
import Link from "next/link";
import { BoardPicker, type PickerBoard } from "@/components/home/board-picker";
import { Hero, type HeroSource } from "@/components/home/hero";
import { StudentIllustration } from "@/components/home/student-illustration";
import { JsonLd } from "@/components/json-ld";
import { CountUp } from "@/components/motion/count-up";
import type { PaperType, SourceAuthority } from "@/db/schema";
import { getBankTotals } from "@/lib/data/coverage";
import { getCatalog } from "@/lib/data/taxonomy";
import { getAllCoverage, getPublicSources } from "@/lib/data/trends";
import { SITE_DESCRIPTION, SITE_NAME, TAGLINE, absoluteUrl, pageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...pageMetadata({ title: `${SITE_NAME}: ${TAGLINE}`, description: SITE_DESCRIPTION, path: "/" }),
  title: { absolute: `${SITE_NAME}: ${TAGLINE}` },
};

const FAQ = [
  {
    q: "Are all the questions real previous-year questions?",
    a: "No, and ExamReady never pretends they are. Only questions stamped Verified PYQ have been checked against a stored board exam paper, and that paper, year, question number and page are shown with the question. Official sample, community and AI practice questions each carry their own stamp.",
  },
  {
    q: "Where do the previous-year questions come from?",
    a: "From official sources such as the question papers and marking schemes published by the board itself. Each source has a public record showing where it came from, how the text was extracted, and how many of its questions have been verified.",
  },
  {
    q: "Why are some questions “awaiting review”?",
    a: "Extracting text from a paper isn't the same as verifying it. Every extracted question waits until an editor has compared it with the official document. Until then it isn't used in PYQ papers or counted in any statistic.",
  },
  {
    q: "What happens if there aren't enough verified questions for my paper?",
    a: "In PYQ modes you're told exactly how many verified marks exist and offered the largest paper they can make. Nothing is made up to fill the gap. You can choose to fill gaps with clearly labelled practice questions instead.",
  },
  {
    q: "Does ExamReady use AI?",
    a: "The core site works without AI. Where AI helps, for example to suggest a chapter for an imported question or to write extra practice, its output is labelled and stays a suggestion. AI never assigns a year, source or PYQ status.",
  },
  {
    q: "Do I need an account?",
    a: "No. Papers and results work without signing up. Your attempts are listed under My practice on the device you used.",
  },
];

export default async function HomePage() {
  const [catalog, coverage, sources, bank] = await Promise.all([getCatalog(), getAllCoverage(), getPublicSources(), getBankTotals()]);
  const latest = sources[0];
  const heroSource: HeroSource = latest
    ? {
        id: latest.id,
        title: latest.title,
        board: latest.board,
        cls: latest.cls,
        subject: latest.subject,
        year: latest.year,
        paperType: latest.paper_type as PaperType,
        paperCode: latest.paper_code,
        authority: latest.authority as SourceAuthority,
        sourceDomain: latest.source_domain,
        extracted: latest.extracted,
        verified: latest.verified,
      }
    : null;

  const pickerBoards: PickerBoard[] = catalog.map((b) => ({
    slug: b.slug,
    name: b.name,
    fullName: b.fullName,
    classes: b.classes.map((c) => {
      const rows = coverage.filter((r) => r.boardSlug === b.slug && r.classSlug === c.slug);
      return {
        level: c.level,
        name: c.name,
        slug: c.slug,
        subjects: c.subjects.length,
        verified: rows.reduce((s, r) => s + r.verified, 0),
        pending: rows.reduce((s, r) => s + r.pending, 0),
      };
    }),
  }));

  const withData = coverage.filter((r) => r.verified > 0 || r.pending > 0);
  const years = [2026, 2025, 2024, 2023, 2022];

  return (
    <>
      <JsonLd
        data={[
          { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/"), description: SITE_DESCRIPTION, potentialAction: { "@type": "SearchAction", target: `${absoluteUrl("/search")}?q={query}`, "query-input": "required name=query" } },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
        ]}
      />

      {/* 1. Hero */}
      <Hero source={heroSource} />

      {/* 2. Board and class */}
      <section aria-labelledby="pick-title" className="container-page py-16 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div data-reveal>
            <h2 id="pick-title" className="text-[2rem] sm:text-[2.5rem]">
              Start with your board and class
            </h2>
            <p className="mt-3 max-w-md text-pencil">Every class is listed. Availability is shown honestly, so you know what&apos;s verified before you start.</p>
          </div>
          <div data-reveal style={{ ["--d" as string]: "100ms" }}>
            <BoardPicker boards={pickerBoards} />
          </div>
        </div>
      </section>

      {/* 3. PYQ-first explanation */}
      <section aria-labelledby="pyq-title" className="border-y border-rule bg-sheet">
        <div className="container-page grid gap-12 py-16 lg:grid-cols-2 lg:py-20">
          <div data-reveal>
            <h2 id="pyq-title" className="text-[2rem] sm:text-[2.5rem]">
              PYQ-first, and honest about everything else
            </h2>
            <p className="mt-4 max-w-xl text-[1.08rem] text-pencil">
              A question is only called a previous-year question after it has been matched to a stored board paper and checked by an editor. Everything else
              is stamped for what it is, with its own colour and shape, so AI practice never looks like a real PYQ.
            </p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ["stamp-verified", "Verified PYQ", "Checked against the listed board paper. Year, paper and question number shown."],
              ["stamp-official", "Official sample", "Official specimen or sample material. Not claimed to be from an exam."],
              ["stamp-contrib", "Community", "Added by a contributor and reviewed before use."],
              ["stamp-ai", "AI practice", "Written by AI for extra practice. Never counted as a PYQ."],
              ["stamp-pending", "Pending review", "Extracted, but not yet checked. Not used in PYQ papers or statistics."],
            ].map(([cls, label, desc], i) => (
              <div key={label} data-reveal className="rounded-2xl border border-rule bg-desk/50 p-4" style={{ ["--d" as string]: `${i * 70}ms` }}>
                <dt>
                  <span className={`stamp ${cls}`}>{label}</span>
                </dt>
                <dd className="mt-2 text-[0.95rem] text-pencil">{desc}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 4. Paper builder preview */}
      <section aria-labelledby="builder-title" className="container-page grid gap-10 py-16 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-24">
        <div data-reveal>
          <h2 id="builder-title" className="text-[2rem] sm:text-[2.5rem]">
            See what a paper is made of before you build it
          </h2>
          <p className="mt-4 max-w-[34rem] text-[1.08rem] text-pencil">
            Pick chapters, marks and time, then choose a mode: PYQ only, recent PYQs, most repeated, exam simulation and more. The builder shows how many
            verified questions exist, year by year, before anything is generated.
          </p>
          <Link href="/practice" className="btn btn-primary mt-7" data-magnetic>
            Open the paper builder
          </Link>
        </div>
        <div data-reveal="in" className="sheet overflow-hidden" role="img" aria-label="Preview of the paper builder">
          <div className="flex items-center justify-between border-b border-rule bg-desk/60 px-5 py-3 text-sm">
            <span className="font-bold">Paper builder</span>
            <span className="text-pencil">Preview with example values</span>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {[
              ["Board and class", "CBSE Class 10"],
              ["Subject", "Science"],
              ["Mode", "Recent PYQs"],
              ["Marks and time", "40 marks, 60 min"],
            ].map(([l, v], i) => (
              <div key={l} className="expand-in rounded-xl border border-rule-strong/60 px-3 py-2" style={{ ["--d" as string]: `${200 + i * 120}ms` }}>
                <p className="text-[0.8rem] font-bold text-pencil">{l}</p>
                <p className="font-bold">{v}</p>
              </div>
            ))}
          </div>
          <div className="mx-5 mb-5 rounded-xl bg-night p-4 text-white">
            <p className="text-[0.85rem] text-white/70">Before generating, you see</p>
            <ul className="mt-2 grid gap-1.5 text-[0.95rem]">
              <li>Verified PYQs available, by year</li>
              <li>Questions still awaiting review</li>
              <li>The exact share of marks from each source</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 5. Recent verified PYQ availability (live) */}
      <section aria-labelledby="avail-title" className="night overflow-hidden">
        <div className="night-mesh" aria-hidden="true" />
        <div className="container-page py-16 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div data-reveal>
              <h2 id="avail-title" className="text-[2rem] sm:text-[2.5rem]">
                What&apos;s in the bank right now
              </h2>
              <p className="mt-3 text-soft">Live counts from the database. The same question in several sets counts once, and each category is counted separately.</p>
              <dl className="mt-8 grid grid-cols-2 gap-x-4 gap-y-5">
                {[
                  ["Verified PYQs", bank.verifiedPyq, "text-[#8ff0c4]"],
                  ["Awaiting editor review", bank.awaitingReview, "text-[#ffd98a]"],
                  ["Official sample questions", bank.officialSample, "text-[#9fe9ff]"],
                  ["AI practice questions", bank.aiPractice, "text-[#cdb8ff]"],
                ].map(([label, n, cls]) => (
                  <div key={label as string}>
                    <dt className="text-[0.85rem] text-white/65">{label}</dt>
                    <dd className={`font-serif text-[2.2rem] font-semibold ${cls}`}>
                      <CountUp value={n as number} />
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-[0.95rem] text-soft">
                From <strong className="text-white">{bank.sources}</strong> official source documents.{" "}
                <Link href="/coverage" className="font-bold text-[#9fe9ff] underline underline-offset-4">
                  See coverage by subject and chapter
                </Link>
              </p>
            </div>
            <div data-reveal className="glass-card overflow-x-auto p-2">
              {withData.length === 0 ? (
                <p className="p-5 text-soft">No verified previous-year questions have been published yet.</p>
              ) : (
                <table className="w-full min-w-[30rem] text-left text-[0.95rem]">
                  <caption className="sr-only">Previous-year question coverage by subject and exam year</caption>
                  <thead>
                    <tr className="text-[0.82rem] text-white/60">
                      <th scope="col" className="px-3 py-2 font-bold">
                        Subject
                      </th>
                      {years.map((y) => (
                        <th key={y} scope="col" className="px-2 py-2 text-center font-bold">
                          {y}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {withData.map((r) => (
                      <tr key={r.subjectId} className="border-t border-white/10">
                        <th scope="row" className="px-3 py-3 font-bold">
                          <Link href={`/pyq/${r.boardSlug}/${r.classSlug}/${r.subjectSlug}`} className="hover:underline">
                            {r.boardName} {r.className} {r.subjectName}
                          </Link>
                        </th>
                        {years.map((y) => (
                          <td key={y} className="px-2 py-3 text-center">
                            {r.years.includes(y) ? (
                              <span className="font-bold text-[#8ff0c4]" title="Verified PYQs available">
                                ✓<span className="sr-only"> verified</span>
                              </span>
                            ) : r.pendingYears.includes(y) ? (
                              <span className="text-[0.8rem] font-bold text-[#ffd98a]" title="Extracted, awaiting review">
                                review<span className="sr-only"> pending</span>
                              </span>
                            ) : (
                              <span className="text-white/35" aria-label="none">
                                —
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="px-3 pb-2 pt-3 text-[0.82rem] text-white/60">✓ verified and published, “review” extracted and awaiting an editor, — no source yet.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. How provenance works (a real sequence) */}
      <section aria-labelledby="how-title" className="container-page py-16 lg:py-24">
        <h2 id="how-title" data-reveal className="max-w-2xl text-[2rem] sm:text-[2.5rem]">
          How a question earns its stamp
        </h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-5">
          {[
            ["Official source", "The paper is taken from the board's own publication, and its URL, code and set are stored."],
            ["Extraction", "Questions, numbers, marks and pages are read from the document's text, or by OCR for scans."],
            ["Duplicate check", "The same question in another set or year is linked, so it's never counted twice."],
            ["Editor review", "An editor compares each question with the official PDF before it can be verified."],
            ["Published", "Only then is it stamped Verified PYQ and used in PYQ papers and trends."],
          ].map(([t, d], i) => (
            <li key={t} data-reveal className="relative rounded-2xl border border-rule bg-sheet p-5" style={{ ["--d" as string]: `${i * 90}ms` }}>
              <span className="grid size-9 place-items-center rounded-full bg-night font-serif text-[1.1rem] font-semibold text-white">{i + 1}</span>
              <h3 className="mt-4 font-sans text-[1.05rem] font-bold">{t}</h3>
              <p className="mt-1 text-[0.95rem] text-pencil">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 7. Features */}
      <section aria-labelledby="features-title" className="border-y border-rule bg-sheet">
        <div className="container-page py-16 lg:py-20">
          <h2 id="features-title" data-reveal className="max-w-2xl text-[2rem] sm:text-[2.5rem]">
            Built for the way you revise
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Eight paper modes", "PYQ only, recent PYQs, most repeated, PYQ + official sample, exam simulation, practice mix and more."],
              ["Timed online tests", "Countdown, question palette and mark-for-review, laid out for a phone. Answers save on your device."],
              ["Official answers", "Where the board publishes a marking scheme, you see its value points after you submit."],
              ["Printable PDFs", "An exam-style paper with marks in the margin, with or without the answer key."],
              ["Source records", "Every official source has a public page: where it came from and what's been verified."],
              ["Smart search", "Type “Class 10 CBSE electricity” or “2026 Science QP 31/2/1” and get the matching questions with their sources."],
            ].map(([t, d], i) => (
              <li key={t} data-reveal className="tilt-card rounded-2xl border border-rule bg-desk/40 p-5" style={{ ["--d" as string]: `${i * 60}ms` }}>
                <h3 className="font-sans text-[1.05rem] font-bold">{t}</h3>
                <p className="mt-1.5 text-pencil">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 8. Trend intelligence */}
      <section aria-labelledby="trend-title" className="container-page grid gap-10 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <div data-reveal>
          <h2 id="trend-title" className="text-[2rem] sm:text-[2.5rem]">
            Trends you can check, not guesses
          </h2>
          <p className="mt-4 max-w-xl text-[1.08rem] text-pencil">
            Chapter frequency, mark distribution and repeated questions are counted from verified papers only. A question is only called &ldquo;most
            repeated&rdquo; when it appeared in more than one exam year, and each subject page shows exactly which years the counts cover.
          </p>
        </div>
        <div data-reveal="in" className="sheet p-6">
          <p className="text-sm font-bold text-pencil">How we count</p>
          <ul className="mt-3 space-y-3">
            {[
              ["Frequency", "Distinct verified exam papers a chapter or question appeared in."],
              ["Repeated", "Same question (after duplicate matching) in 2+ different exam years."],
              ["Recency", "Most recent verified year first: 2026, then 2025, then earlier."],
              ["Excluded", "AI practice, official samples and anything awaiting review."],
            ].map(([k, v]) => (
              <li key={k} className="grid grid-cols-[6.5rem_1fr] gap-3 border-t border-rule pt-3 first:border-0 first:pt-0">
                <span className="font-bold">{k}</span>
                <span className="text-pencil">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 10. Student workflow */}
      <section aria-labelledby="flow-title" className="container-page grid items-center gap-12 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
        <div data-reveal="in" className="mx-auto w-full max-w-sm">
          <StudentIllustration className="h-auto w-full" />
        </div>
        <div>
          <h2 id="flow-title" data-reveal className="text-[2rem] sm:text-[2.5rem]">
            From chapter list to results in five steps
          </h2>
          <ol className="mt-8 space-y-4">
            {[
              ["Choose board, class and subject", "ICSE or CBSE, Classes 6 to 12."],
              ["Pick chapters, marks and time", "One chapter the night before a test, or the full syllabus."],
              ["Choose a mode", "Verified PYQs only, recent years, most repeated, or a practice mix."],
              ["Take the test or print it", "Timed online, or a clean PDF for pen and paper."],
              ["Review every answer", "Scores by chapter, type and section, with official answers where published."],
            ].map(([t, d], i) => (
              <li key={t} data-reveal className="flex gap-4" style={{ ["--d" as string]: `${i * 80}ms` }}>
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-ink-line bg-ink-soft font-serif text-[1.15rem] font-semibold text-ink">
                  {i + 1}
                </span>
                <span>
                  <strong className="block">{t}</strong>
                  <span className="text-pencil">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-title" className="border-t border-rule bg-sheet">
        <div className="container-page grid gap-10 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:py-20">
          <h2 id="faq-title" data-reveal className="text-[2rem] sm:text-[2.5rem]">
            Questions students ask
          </h2>
          <div className="divide-y divide-rule border-y border-rule">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-2">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-2 text-[1.08rem] font-bold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 text-ink transition-transform group-open:rotate-45" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </summary>
                <p className="prose-width expand-in pb-4 text-pencil">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 11. CTA */}
      <section aria-labelledby="cta-title" className="container-page py-16">
        <div className="night overflow-hidden rounded-3xl px-6 py-12 sm:px-12">
          <div className="night-mesh" aria-hidden="true" />
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="cta-title" className="text-[1.9rem] sm:text-[2.3rem]">
                Your next test is a few taps away.
              </h2>
              <p className="mt-2 text-soft">Pick a subject, set the marks, and start.</p>
            </div>
            <Link href="/practice" className="btn btn-glow px-6 text-[1.05rem]" data-magnetic>
              Build a practice paper
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
