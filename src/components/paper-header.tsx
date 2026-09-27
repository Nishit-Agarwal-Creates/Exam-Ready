import type { PaperView } from "@/lib/data/papers";

export function PaperHeader({ paper }: { paper: PaperView }) {
  return (
    <div className="border-b-2 border-graphite pb-4 text-center">
      <p className="font-serif text-[1.05rem] text-pencil">ExamReady practice paper</p>
      <h1 className="mt-1 text-[1.6rem] sm:text-[2rem]">
        {paper.board.name} {paper.cls.name} {paper.subject.name}
      </h1>
      <p className="mt-1 font-serif text-[1.05rem]">{paper.chapterNames.length ? paper.chapterNames.join(", ") : "Full syllabus"}</p>
      <p className="mt-3 flex flex-wrap justify-center gap-x-8 gap-y-1 font-serif text-[1.05rem]">
        <span>Maximum marks: {paper.totalMarks}</span>
        <span>Time allowed: {paper.durationMinutes} minutes</span>
      </p>
    </div>
  );
}
