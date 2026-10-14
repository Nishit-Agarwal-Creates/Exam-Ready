import { isAdmin } from "@/lib/auth";
import { ANSWER_ISSUES, answerQueueCsv } from "@/lib/data/answers";
import type { AnswerIssue } from "@/lib/engine/answers";

export const dynamic = "force-dynamic";

/** CSV report of the answer-and-marks queue (admins only). */
export async function GET(request: Request) {
  if (!(await isAdmin())) return new Response("Sign in as an editor to export.", { status: 401 });
  const sp = new URL(request.url).searchParams;
  const issue = ANSWER_ISSUES.find((i) => i.key === sp.get("issue"))?.key as AnswerIssue | undefined;
  const subject = Number(sp.get("subject"));
  const csv = await answerQueueCsv({ issue, subjectId: Number.isInteger(subject) && subject > 0 ? subject : undefined });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="examready-answers${issue ? `-${issue.toLowerCase()}` : ""}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
