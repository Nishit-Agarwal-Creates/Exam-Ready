import type { Metadata } from "next";
import Link from "next/link";
import { CompositionBar } from "@/components/composition";
import { JsonLd } from "@/components/json-ld";
import { SITE_DESCRIPTION, SITE_NAME, TAGLINE, absoluteUrl, pageMetadata } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMetadata({ title: `${SITE_NAME}: ${TAGLINE}`, description: SITE_DESCRIPTION, path: "/" }),
  title: { absolute: `${SITE_NAME}: ${TAGLINE}` },
};

const FAQ = [
  {
    q: "Are all the questions real previous-year questions?",
    a: "No, and ExamReady never pretends they are. Only questions stamped Verified PYQ have been checked against a listed board exam paper, and that paper is shown with the question. Official sample, contributed and AI-generated questions each carry their own label.",
  },
  {
    q: "What happens if there aren't enough verified questions for my paper?",
    a: "In PYQ only mode you are told how many verified marks exist and offered the largest paper they can make. Nothing is made up to fill the gap. In PYQ priority mode the gap is filled with labelled non-PYQ questions, and the paper shows exactly what share came from where.",
  },
  {
    q: "Does ExamReady use AI?",
    a: "The current version generates papers from the stored question bank without AI. AI-generated questions, where they exist in the bank, are labelled AI-generated and are never used in PYQ only papers. AI is never allowed to assign a year or source to a question.",
  },
  {
    q: "How are long answers marked?",
    a: "Multiple choice, fill in the blank and numerical answers are marked automatically. For written answers you compare your answer with the model answer and award your own marks, just as you would with a marking scheme.",
  },
  {
    q: "Do I need an account?",
    a: "No. Papers and results work without signing up. Your attempts are listed under My practice on the device you used.",
  },
  {
    q: "Which boards and classes are covered?",
    a: "ICSE Classes 8, 9 and 10 in Mathematics, Physics, Chemistry and Biology. CBSE and other boards are planned but not available yet.",
  },
];

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: SITE_NAME,
            url: absoluteUrl("/"),
            description: SITE_DESCRIPTION,
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
        ]}
      />

      {/* 1. Hero */}
      <section aria-labelledby="hero-title" className="overflow-hidden">
        <div className="container-page grid items-center gap-12 pb-16 pt-10 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-rule bg-sheet px-3 py-1 text-sm font-bold text-pencil">
              <span className="size-2 rounded-full bg-verified" aria-hidden="true" />
              ICSE Classes 8, 9 and 10
            </p>
            <h1 id="hero-title" className="text-[2.6rem] leading-[1.02] sm:text-[3.6rem] lg:text-[4.25rem]">
              Practice what was actually asked.
            </h1>
            <p className="mt-6 max-w-[36rem] text-[1.15rem] leading-relaxed text-pencil sm:text-[1.25rem]">
              Build custom exam papers from verified previous questions, practise online, and understand exactly where you stand.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/practice" className="btn btn-primary px-6 text-[1.05rem]">
                Build a practice paper
              </Link>
              <Link href="/how-it-works" className="btn btn-secondary px-6 text-[1.05rem]">
                How questions are verified
              </Link>
            </div>
            <p className="mt-5 text-[0.95rem] text-pencil">Free to use. No sign-up needed.</p>
          </div>

          <HeroSheet />
        </div>
      </section>

      {/* 2. Paper generator preview */}
      <section aria-labelledby="gen-title" className="border-y border-rule bg-sheet">
        <div className="container-page grid gap-10 py-16 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:py-20">
          <div>
            <h2 id="gen-title" className="text-[2rem] sm:text-[2.4rem]">
              Set the paper you need. See what it&apos;s made of before you start.
            </h2>
            <p className="mt-4 max-w-[34rem] text-[1.08rem] text-pencil">
              Pick the chapters you are revising, the marks and the time. ExamReady shows how many verified questions are available and what share of your
              paper will come from past papers, before it builds anything.
            </p>
            <Link href="/practice" className="btn btn-primary mt-7">
              Open the paper builder
            </Link>
          </div>
          <GeneratorPreview />
        </div>
      </section>

      {/* 3. Why ExamReady */}
      <section aria-labelledby="why-title" className="container-page py-16 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <h2 id="why-title" className="text-[2rem] sm:text-[2.4rem]">
            Why practise with ExamReady
          </h2>
          <ul className="divide-y divide-rule border-y border-rule">
            {[
              {
                t: "Past-paper questions come first",
                d: "Papers are built from questions that were checked against real board papers. Other material is only used when you allow it and there isn't enough.",
              },
              {
                t: "Every question shows where it came from",
                d: "Each question carries a source stamp: verified PYQ, official sample, contributed or AI-generated. Open the details to see the paper and year behind it.",
              },
              {
                t: "Straight answers when data runs out",
                d: "If a chapter doesn't have enough verified questions, you are told how many there are. The gap is never quietly filled with invented questions.",
              },
              {
                t: "Results you can act on",
                d: "After each test you see marks by chapter and question type, so you know which chapter to revise next rather than just a total.",
              },
            ].map((item) => (
              <li key={item.t} className="grid gap-1 py-6 sm:grid-cols-[14rem_1fr] sm:gap-8">
                <h3 className="font-sans text-[1.08rem] font-bold leading-snug">{item.t}</h3>
                <p className="text-pencil">{item.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. How it works */}
      <section aria-labelledby="how-title" className="bg-ink text-white">
        <div className="container-page py-16 lg:py-20">
          <h2 id="how-title" className="text-[2rem] text-white sm:text-[2.4rem]">
            From chapter list to results in five steps
          </h2>
          <ol className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Choose your class and subject", "ICSE Class 8, 9 or 10."],
              ["Pick chapters, marks and time", "Revise one chapter or the whole syllabus."],
              ["Choose how strict to be", "PYQ only, PYQ priority or a full exam simulation."],
              ["Take the test or print it", "Timed online test, or a PDF for pen and paper."],
              ["See where marks were lost", "Scores by chapter and question type, with model answers."],
            ].map(([t, d], i) => (
              <li key={t} className="border-t-2 border-white/30 pt-4">
                <span className="font-serif text-[2rem] font-semibold leading-none text-white/60">{i + 1}</span>
                <h3 className="mt-3 font-sans text-[1.05rem] font-bold text-white">{t}</h3>
                <p className="mt-1 text-white/80">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 5. PYQ-first explanation */}
      <section aria-labelledby="pyq-title" className="container-page py-16 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 id="pyq-title" className="text-[2rem] sm:text-[2.4rem]">
              What &ldquo;PYQ&rdquo; means here
            </h2>
            <p className="mt-4 text-[1.08rem] text-pencil">
              A question is only called a previous-year question when it has been matched to a specific board exam paper, and that paper is stored with it.
              Everything else is labelled for what it is.
            </p>
            <dl className="mt-8 space-y-5">
              <div>
                <dt>
                  <span className="stamp stamp-verified">Verified PYQ</span>
                </dt>
                <dd className="mt-1.5 text-pencil">Checked against the listed board exam paper. The year and paper are shown with the question.</dd>
              </div>
              <div>
                <dt>
                  <span className="stamp stamp-official">Official sample</span>
                </dt>
                <dd className="mt-1.5 text-pencil">From official specimen or sample material. Useful practice, but not claimed to have appeared in an exam.</dd>
              </div>
              <div>
                <dt>
                  <span className="stamp stamp-contrib">Contributed</span>
                </dt>
                <dd className="mt-1.5 text-pencil">Added by a contributor and reviewed before use. Not claimed to be from a past paper.</dd>
              </div>
              <div>
                <dt>
                  <span className="stamp stamp-ai">AI-generated</span>
                </dt>
                <dd className="mt-1.5 text-pencil">Written by AI to fill gaps. Never used in PYQ only papers and never given a year.</dd>
              </div>
            </dl>
          </div>
          <div className="sheet p-6 sm:p-8">
            <h3 className="font-sans text-[1.05rem] font-bold">Every paper shows its real make-up</h3>
            <p className="mt-1 text-[0.95rem] text-pencil">
              The share is worked out from the questions actually on your paper. It is never a fixed promise like &ldquo;90% PYQs&rdquo;.
            </p>
            <div className="mt-6">
              <CompositionBar
                caption="Example: a 40-mark PYQ priority paper"
                demo={false}
                composition={{
                  VERIFIED_PYQ: { count: 17, marks: 33 },
                  OFFICIAL_SAMPLE: { count: 2, marks: 3 },
                  USER_CONTRIBUTED: { count: 0, marks: 0 },
                  AI_SUPPLEMENTARY: { count: 2, marks: 4 },
                }}
              />
            </div>
            <p className="mt-5 border-t border-rule pt-4 text-sm text-pencil">Illustration with example numbers.</p>
          </div>
        </div>
      </section>

      {/* 6. Supported boards and classes */}
      <section aria-labelledby="boards-title" className="border-y border-rule bg-sheet">
        <div className="container-page py-16">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="boards-title" className="text-[2rem] sm:text-[2.4rem]">
              Boards and classes
            </h2>
            <Link href="/subjects" className="link font-bold">
              All subjects
            </Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-[2fr_1fr]">
            <div className="rounded-md border border-rule p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[1.5rem]">ICSE</h3>
                <span className="text-sm font-bold text-verified">Available</span>
              </div>
              <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                {[10, 9, 8].map((c) => (
                  <li key={c}>
                    <Link
                      href={`/icse/class-${c}`}
                      className="flex min-h-16 flex-col justify-center rounded-md border border-rule-strong bg-desk/40 px-4 py-3 transition-colors hover:border-ink hover:bg-ink-soft"
                    >
                      <span className="font-serif text-[1.3rem] font-semibold">Class {c}</span>
                      <span className="text-sm text-pencil">Maths, Physics, Chemistry, Biology</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-dashed border-rule-strong p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[1.5rem] text-pencil">CBSE</h3>
                <span className="text-sm font-bold text-pencil">Coming later</span>
              </div>
              <p className="mt-4 text-pencil">CBSE, state boards and foundation courses are planned. They will be added once verified questions are ready.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Features */}
      <section aria-labelledby="features-title" className="container-page py-16 lg:py-24">
        <h2 id="features-title" className="max-w-2xl text-[2rem] sm:text-[2.4rem]">
          Built for the way you actually revise
        </h2>
        <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Timed online tests", "A countdown, a question palette, and mark-for-review, laid out for a phone screen."],
            ["Nothing lost if the tab closes", "Answers save on your device as you go. Reopen the test and carry on."],
            ["Printable PDF papers", "A clean exam-style paper with marks in the margin, for practising with a pen."],
            ["Chapter-wise practice", "Build a paper from one chapter the night before a unit test."],
            ["Model answers after you submit", "See the expected answer for every question, and mark your written answers yourself."],
            ["Topic pages worth reading", "Chapter lists, topics and question counts for every ICSE subject, all linked to practice."],
          ].map(([t, d]) => (
            <li key={t} className="border-l-2 border-margin/60 pl-4">
              <h3 className="font-sans text-[1.05rem] font-bold">{t}</h3>
              <p className="mt-1 text-pencil">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 8. Performance analytics preview */}
      <section aria-labelledby="results-title" className="border-y border-rule bg-desk-deep/60">
        <div className="container-page grid gap-10 py-16 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-20">
          <div>
            <h2 id="results-title" className="text-[2rem] sm:text-[2.4rem]">
              Know which chapter cost you marks
            </h2>
            <p className="mt-4 max-w-[34rem] text-[1.08rem] text-pencil">
              Results break your score down by chapter and question type, point out the chapters under 60%, and show how much of the paper came from verified
              past questions. No predicted board scores, just what happened in this test.
            </p>
          </div>
          <ResultsPreview />
        </div>
      </section>

      {/* 9. FAQ */}
      <section aria-labelledby="faq-title" className="container-page py-16 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <h2 id="faq-title" className="text-[2rem] sm:text-[2.4rem]">
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
                <p className="prose-width pb-4 text-pencil">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 10. CTA */}
      <section aria-labelledby="cta-title" className="container-page">
        <div className="sheet sheet-ruled flex flex-col items-start gap-6 py-10 pr-6 sm:flex-row sm:items-center sm:justify-between sm:py-12 sm:pr-10">
          <div>
            <h2 id="cta-title" className="text-[1.9rem] sm:text-[2.2rem]">
              Your next test is a few taps away.
            </h2>
            <p className="mt-2 text-pencil">Pick a chapter, set the marks, and start.</p>
          </div>
          <Link href="/practice" className="btn btn-primary px-6 text-[1.05rem]">
            Build a practice paper
          </Link>
        </div>
      </section>
    </>
  );
}

function HeroSheet() {
  return (
    <figure className="relative m-0 lg:justify-self-end">
      <div className="sheet sheet-ruled anim-sheet relative w-full max-w-[34rem] py-6 pr-5 sm:py-8 sm:pr-8">
        <div className="border-b-2 border-graphite pb-3 text-center">
          <p className="font-serif text-[1.15rem] font-semibold">ICSE Class 10 Chemistry</p>
          <p className="mt-0.5 flex justify-center gap-5 font-serif text-[0.92rem] text-pencil">
            <span>Maximum marks: 40</span>
            <span>Time: 1 hour</span>
          </p>
        </div>
        <p className="mt-4 font-serif text-[0.95rem] font-semibold">Section A</p>
        <ol className="mt-2 space-y-4 font-serif text-[0.98rem] leading-relaxed sm:text-[1.03rem]">
          <li className="grid grid-cols-[1.6rem_1fr_auto] gap-x-2">
            <span className="font-semibold">1.</span>
            <span>
              State one observation when dilute hydrochloric acid is added to sodium carbonate.
              <span className="mt-1.5 flex">
                <span className="stamp stamp-verified anim-stamp origin-left">Verified PYQ</span>
              </span>
            </span>
            <span className="marks">[1]</span>
          </li>
          <li className="grid grid-cols-[1.6rem_1fr_auto] gap-x-2">
            <span className="font-semibold">2.</span>
            <span>
              Calculate the number of moles in 4.4 g of carbon dioxide. [C = 12, O = 16]
              <span className="mt-1.5 flex">
                <span className="stamp stamp-official">Official sample</span>
              </span>
            </span>
            <span className="marks">[2]</span>
          </li>
          <li className="grid grid-cols-[1.6rem_1fr_auto] gap-x-2">
            <span className="font-semibold">3.</span>
            <span>
              Explain why ammonia gas is not collected over water.
              <span className="mt-1.5 flex">
                <span className="stamp stamp-ai">AI-generated</span>
              </span>
            </span>
            <span className="marks">[2]</span>
          </li>
        </ol>
      </div>
      <figcaption className="mt-3 max-w-[34rem] text-sm text-pencil">
        Illustration of a generated paper with example questions. Each question is stamped with its source.
      </figcaption>
    </figure>
  );
}

function GeneratorPreview() {
  return (
    <div className="panel p-5 sm:p-6" aria-label="Preview of the paper builder" role="img">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["Board", "ICSE"],
          ["Class", "Class 9"],
          ["Subject", "Chemistry"],
          ["Mode", "PYQ priority"],
          ["Marks", "40"],
          ["Time", "60 minutes"],
        ].map(([l, v]) => (
          <div key={l}>
            <p className="text-sm font-bold text-pencil">{l}</p>
            <p className="mt-1 rounded-md border border-rule-strong bg-sheet px-3 py-2 font-bold">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <p className="text-sm font-bold text-pencil">Chapters</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {["Atomic Structure and Chemical Bonding", "The Periodic Table"].map((c) => (
            <span key={c} className="rounded-md border border-ink bg-ink-soft px-3 py-1.5 text-[0.92rem] font-bold text-ink">
              {c}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 rounded-md bg-desk px-4 py-3">
        <p>
          <span className="block text-sm text-pencil">Verified questions available</span>
          <span className="num font-serif text-[1.6rem] font-semibold">124</span>
        </p>
        <p>
          <span className="block text-sm text-pencil">Estimated PYQ share</span>
          <span className="num font-serif text-[1.6rem] font-semibold">92%</span>
        </p>
      </div>
      <p className="mt-3 text-sm text-pencil">Preview with example numbers. The real builder shows live counts from the question bank.</p>
    </div>
  );
}

function ResultsPreview() {
  const rows: [string, number][] = [
    ["Atomic Structure and Chemical Bonding", 82],
    ["The Periodic Table", 45],
    ["Study of Gas Laws", 67],
  ];
  return (
    <div className="sheet p-5 sm:p-7" role="img" aria-label="Example results screen showing 29 out of 40 and chapter scores">
      <div className="flex items-center gap-5">
        <div className="relative grid size-24 shrink-0 place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0" aria-hidden="true">
            <path d="M50 6c26 0 44 17 44 43 0 27-20 45-45 45C23 94 6 76 6 51 6 26 25 8 52 7" fill="none" stroke="var(--color-margin)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="font-serif text-[1.7rem] font-semibold leading-none text-margin">
            29<span className="text-[1rem] text-margin/80">/40</span>
          </span>
        </div>
        <div>
          <p className="font-serif text-[1.4rem] font-semibold">73%</p>
          <p className="text-sm text-pencil">31 of 34 answered, 48 min used</p>
        </div>
      </div>
      <ul className="mt-6 space-y-3">
        {rows.map(([name, p]) => (
          <li key={name}>
            <div className="flex justify-between gap-3 text-[0.93rem]">
              <span>{name}</span>
              <span className={`num font-bold ${p < 60 ? "text-margin" : ""}`}>{p}%</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-desk-deep">
              <div className="h-full rounded-full" style={{ width: `${p}%`, background: p < 60 ? "var(--color-margin)" : "var(--color-ink)" }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-5 border-t border-rule pt-4 text-sm text-pencil">Example results screen.</p>
    </div>
  );
}
