import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExamRunner, type ExamQuestion } from "@/components/exam-runner";
import { getPaper } from "@/lib/data/papers";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const paper = await getPaper(id, false);
  return { title: paper ? `Test: ${paper.cls.name} ${paper.title}` : "Test not found", robots: { index: false, follow: false } };
}

export default async function TestPage({ params }: Props) {
  const { id } = await params;
  // Answers are deliberately not loaded: the answer key never reaches the browser during a test.
  const paper = await getPaper(id, false);
  if (!paper) notFound();
  const questions: ExamQuestion[] = paper.items.map((item, i) => ({
    id: item.question.id,
    number: i + 1,
    section: item.section,
    marks: item.marks,
    text: item.question.text,
    type: item.question.type,
    options: item.question.options,
    chapter: item.question.chapter.name,
    isDemo: item.question.isDemo,
    sourceType: item.question.sourceType,
    verificationStatus: item.question.verificationStatus,
    sources: item.question.sources,
  }));
  return (
    <ExamRunner
      paper={{
        id: paper.id,
        title: `${paper.board.name} ${paper.cls.name} ${paper.subject.name}`,
        scope: paper.chapterNames.length ? paper.chapterNames.join(", ") : "Full syllabus",
        totalMarks: paper.totalMarks,
        durationMinutes: paper.durationMinutes,
        hasDemo: paper.hasDemo,
        mode: paper.mode,
      }}
      questions={questions}
    />
  );
}
