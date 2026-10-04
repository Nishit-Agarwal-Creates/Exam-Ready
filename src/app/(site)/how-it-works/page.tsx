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
              ["#ai-practice", "The AI practice bank"],
            ].map(([h, l]) => (
              <li key={h}>
                <a href={h} className="inline-flex min-h-9 items-center text-pencil hover:text-ink hover:underline">
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="prose-width min-w-0 space-y-14">
          <section id="sources" aria-labelledby="sources-title">
            <h2 id="sources-title" className="text-[1.8rem]">
              Question sources
            </h2>
            <p className="mt-3 text-pencil">Every question in the bank belongs to exactly one of these categories, shown as a stamp next to it. Official documents are also named for what they are: a board paper, a specimen, a sample paper, a question bank or a school paper.</p>
            <dl className="mt-6 space-y-5">
              {(
                [
                  ["VERIFIED_PYQ", "stamp-verified"],
                  ["OFFICIAL_SAMPLE", "stamp-official"],
                  ["USER_CONTRIBUTED", "stamp-contrib"],
                  ["AI_SUPPLEMENTARY", "stamp-ai"],
                  ["PENDING_REVIEW", "stamp-pending"],
                ] as const
              ).map(([k, cls]) => (
                <div key={k} className="grid min-w-0 gap-2 sm:grid-cols-[11rem_1fr]">
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
              <li>
                <strong>Source.</strong> The document comes from an official publisher where possible, for example the question papers and marking schemes
                CBSE publishes on cbse.gov.in. Its URL, the file inside any archive, the year, question-paper code, set and a checksum are stored. See{" "}
                <Link href="/sources" className="link">
                  all sources
                </Link>
                .
              </li>
              <li>
                <strong>Extraction.</strong> Questions are read from the document&apos;s text layer, or by OCR for scans, with the page, question number,
                section and marks. Anything the text lost (a symbol, a figure, a table) is noted against the question, and OCR confidence is recorded.
              </li>
              <li>
                <strong>Duplicates.</strong> The same question in another set or year is linked to one canonical question, so it is never counted twice.
              </li>
              <li>
                <strong>Review.</strong> An editor compares each question with the official document. Chapter mappings suggested by keywords or AI are
                confirmed or corrected at the same time.
              </li>
              <li>
                <strong>Verified and published.</strong> Only then is it stamped <em>Verified PYQ</em>. The system refuses that label for any question
                without a linked board paper that has a year, and for anything written by AI.
              </li>
            </ol>
            <p className="mt-4 text-pencil">
              Frequency and trends count distinct verified papers and years per duplicate group. &ldquo;Repeated&rdquo; means the same question appeared in
              two or more different exam years; several sets of one year&apos;s paper don&apos;t count as a repeat.
            </p>
          </section>

          <section id="modes" aria-labelledby="modes-title">
            <h2 id="modes-title" className="text-[1.8rem]">
              Paper modes
            </h2>
            <dl className="mt-4 space-y-4">
              {(["PYQ_ONLY", "RECENT_PYQ", "MOST_REPEATED", "PYQ_PRIORITY", "EXAM_SIMULATION", "PYQ_PLUS_OFFICIAL", "PRACTICE", "AI_SUPPLEMENTARY"] as const).map((m) => (
                <div key={m}>
                  <dt className="font-bold">{MODE_LABELS[m].name}</dt>
                  <dd className="text-pencil">{MODE_LABELS[m].description}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-pencil">
              Every paper shows its actual make-up, worked out from the questions on that paper. PYQ modes only ever use verified PYQs; other questions
              fill gaps only when you allow it. Questions awaiting review and rejected questions are never used.
            </p>
          </section>

          <section id="marking" aria-labelledby="marking-title">
            <h2 id="marking-title" className="text-[1.8rem]">
              Marking and results
            </h2>
            <p className="mt-3 text-pencil">
              Multiple choice, assertion–reason, fill in the blank and numerical answers are marked automatically when an answer key exists. For board
              questions, keys and model answers come only from the official marking scheme; where none is published, you mark yourself and no answer is
              invented. The answer key is never sent to your browser during the test.
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
              ExamReady works without AI. Where it is switched on (Cloudflare Workers AI, free, no API key), it can suggest a chapter for an imported question
              and draft extra practice questions. Suggestions stay suggestions until an editor confirms them, and AI-written questions always carry the AI
              practice stamp and never count towards PYQ statistics. AI is never allowed to assign a year, paper, question number, source or PYQ status.
            </p>
          </section>

          <section id="ai-practice" aria-labelledby="ai-practice-title">
            <h2 id="ai-practice-title" className="text-[1.8rem]">
              The AI practice bank
            </h2>
            <p className="mt-3">
              <span className="stamp stamp-ai">{DEMO_LABEL}</span>
            </p>
            <p className="mt-3 text-pencil">
              The ICSE Classes 8–10 practice bank was written by AI. It is stored as AI practice, has no source paper, no year and no frequency, and is
              stamped AI practice wherever it appears, including in PDFs. It is never counted as a previous-year question and never fills a PYQ-only paper.
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
