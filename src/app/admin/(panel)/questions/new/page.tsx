import Link from "next/link";
import { QuestionForm } from "@/components/admin/question-form";
import { getFormData } from "@/lib/data/admin-form";

export const metadata = { title: "Add question" };

export default async function NewQuestionPage() {
  const { catalog, papers } = await getFormData();
  return (
    <div className="max-w-4xl">
      <p className="text-sm">
        <Link href="/admin/questions" className="link">
          Questions
        </Link>
      </p>
      <h1 className="mt-1 text-[2rem]">Add question</h1>
      <p className="mt-2 text-pencil">
        New questions start unverified. A question can only be saved as a Verified PYQ once it is linked to a board exam paper that has a year.
      </p>
      <div className="mt-6">
        <QuestionForm
          catalog={catalog}
          papers={papers}
          isDemo={false}
          hasSources={false}
          initial={{
            questionType: "SHORT_ANSWER",
            marks: 2,
            difficulty: "MEDIUM",
            questionText: "",
            options: [],
            acceptedAnswers: "",
            numericValue: "",
            numericTolerance: "",
            numericUnit: "",
            answerText: "",
            explanation: "",
            sourceType: "USER_CONTRIBUTED",
            verificationStatus: "UNVERIFIED",
            verificationNotes: "",
            isPublished: true,
          }}
        />
      </div>
    </div>
  );
}
