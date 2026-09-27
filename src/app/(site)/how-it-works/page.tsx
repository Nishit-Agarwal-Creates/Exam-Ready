import type { Metadata } from "next";
import Link from "next/link";
import { MODE_LABELS } from "@/lib/engine/generator";
import { DEMO_LABEL, SOURCE_LABELS } from "@/lib/provenance";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "How ExamReady works",
  description:
    "How ExamReady verifies previous-year questions, labels every other source, builds practice papers, and marks your answers. Verified questions are backed by their listed source.",
  path: "/how-it-works",
});

export default function HowItWorksPage() {
  return (
    <div className="container-page py-8 sm:py-12">
      <header className="max-w-3xl">
        <h1 className="text-[2.2rem] sm:text-[2.8rem]">How ExamReady works</h1>
        <p className="mt-4 text-[1.15rem] text-pencil">
          ExamReady is built around one promise: verified questions are backed by their listed source. If a question isn&apos;t verified, it says so.
        </p>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ul className="sticky top-24 space-y-1 text-[0.95rem]">
            {[
              ["#sources", "Question sources"],
              ["#verification", "How verification works"],
              ["#modes", "Paper modes"],
              ["#marking", "Marking and results"],
              ["#ai", "Where AI fits"],
              ["#demo", "Demo data"],
            ].map(([h, l]) => (
              <li key={h}>
                <a href={h} className="inline-flex min-h-9 items-center text-pencil hover:text-ink hover:underline">
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="prose-width space-y-14">
          <section id="sources" aria-labelledby="sources-title">
            <h2 id="sources-title" className="text-[1.8rem]">
              Question sources
            </h2>
            <p className="mt-3 text-pencil">Every question in the bank belongs to exactly one of four categories, shown as a stamp next to it.</p>
            <dl className="mt-6 space-y-5">
              {(
                [
                  ["VERIFIED_PYQ", "stamp-verified"],
                  ["OFFICIAL_SAMPLE", "stamp-official"],
                  ["USER_CONTRIBUTED", "stamp-contrib"],
                  ["AI_SUPPLEMENTARY", "stamp-ai"],
                ] as const
              ).map(([k, cls]) => (
                <div key={k} className="grid gap-2 sm:grid-cols-[11rem_1fr]">
                  <dt>
                    <span className={`stamp ${cls}`}>{SOURCE_LABELS[k].short}</span>
                  </dt>
                  <dd>
                    <strong>{SOURCE_LABELS[k].long}.</strong> {SOURCE_LABELS[k].description}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="verification" aria-labelledby="verification-title">
            <h2 id="verification-title" className="text-[1.8rem]">
              How verification works
            </h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5">
              <li>A source paper is added with its board, class, subject, year and, where possible, a link to the original.</li>
              <li>Questions from that paper are entered or imported, then reviewed one by one by an editor.</li>
              <li>Each question is linked to the paper and question number it came from.</li>
              <li>
                Only then can it be marked <em>Verified PYQ</em>. The system refuses that label for any question without a linked board paper that has a year.
              </li>
            </ol>
            <p className="mt-4 text-pencil">
              When the same question appears in several papers, each appearance is stored. Frequency notes like &ldquo;asked in 3 stored papers&rdquo; are
              counted from those links and never estimated.
            </p>
          </section>

          <section id="modes" aria-labelledby="modes-title">
            <h2 id="modes-title" className="text-[1.8rem]">
              Paper modes
            </h2>
            <dl className="mt-4 space-y-4">
              {(["PYQ_ONLY", "PYQ_PRIORITY", "EXAM_SIMULATION"] as const).map((m) => (
                <div key={m}>
                  <dt className="font-bold">{MODE_LABELS[m].name}</dt>
                  <dd className="text-pencil">{MODE_LABELS[m].description}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-pencil">
              Every paper shows its actual make-up, such as the share of marks from verified PYQs, worked out from the questions on that paper. Unverified
              and rejected questions are never used in papers.
            </p>
          </section>

          <section id="marking" aria-labelledby="marking-title">
            <h2 id="marking-title" className="text-[1.8rem]">
              Marking and results
            </h2>
            <p className="mt-3 text-pencil">
              Multiple choice, fill in the blank and numerical answers are marked automatically when you submit. The answer key is never sent to your browser
              during the test. Written answers are shown next to the model answer so you can award your own marks. Until you do, your score is shown as
              provisional.
            </p>
            <p className="mt-3 text-pencil">
              Results show marks by chapter, question type and source, and list chapters under 60% as revision priorities. ExamReady doesn&apos;t predict board
              exam scores.
            </p>
          </section>

          <section id="ai" aria-labelledby="ai-title">
            <h2 id="ai-title" className="text-[1.8rem]">
              Where AI fits
            </h2>
            <p className="mt-3 text-pencil">
              The current version doesn&apos;t need AI to work. In future, AI may help sort imported questions into chapters, spot duplicates, and write extra
              practice questions. AI-written questions will always carry the AI-generated stamp, and AI is never allowed to assign a year, paper or other
              source to a question.
            </p>
          </section>

          <section id="demo" aria-labelledby="demo-title">
            <h2 id="demo-title" className="text-[1.8rem]">
              Demo data
            </h2>
            <p className="demo-banner mt-3 px-4 py-3 font-bold">{DEMO_LABEL}</p>
            <p className="mt-3 text-pencil">
              This build includes demo questions so every feature can be tried. They were written for demonstration, are linked only to fictional demo papers
              with no year, and carry the label above wherever they appear, including in PDFs. They are tagged with stand-in categories only so that paper
              modes can be tested.
            </p>
          </section>

          <Link href="/practice" className="btn btn-primary">
            Build a practice paper
          </Link>
        </div>
      </div>
    </div>
  );
}
