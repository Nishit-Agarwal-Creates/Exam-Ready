"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { SOURCE_TYPES } from "@/db/schema";
import { checkPassword, createAdminSession, destroyAdminSession, isAdminConfigured, requireAdmin } from "@/lib/auth";
import {
  addSourceLink,
  createImportBatch,
  deletePaper,
  deleteQuestion,
  getImportBatch,
  markItemApproved,
  paperInputSchema,
  purgeDemoData,
  questionInputSchema,
  rejectImportItem,
  removeSourceLink,
  saveQuestion,
  savePaper,
} from "@/lib/data/admin";
import { eq } from "drizzle-orm";

const ACTOR = "admin";
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const withMsg = (path: string, key: "error" | "saved", msg: string) => `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`;

// ───────────── Session ─────────────

export async function loginAction(_prev: { error?: string } | undefined, fd: FormData) {
  if (!(await isAdminConfigured())) {
    return { error: "Admin sign-in isn't set up. Set ADMIN_PASSWORD (8+ characters) and SESSION_SECRET (32+ characters)." };
  }
  const ok = await checkPassword(str(fd, "password"));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 700)); // slow down guessing
    return { error: "That password is incorrect." };
  }
  await createAdminSession();
  redirect("/admin");
}

export async function logoutAction() {
  await destroyAdminSession();
  redirect("/admin/login");
}

// ───────────── Questions ─────────────

export type QuestionFormState = { errors?: Record<string, string> } | undefined;

export async function saveQuestionAction(_prev: QuestionFormState, fd: FormData): Promise<QuestionFormState> {
  await requireAdmin();
  const parsed = questionInputSchema.safeParse({
    id: str(fd, "id") || undefined,
    subjectId: str(fd, "subjectId"),
    chapterId: str(fd, "chapterId"),
    topicId: str(fd, "topicId"),
    questionType: str(fd, "questionType"),
    marks: str(fd, "marks"),
    difficulty: str(fd, "difficulty"),
    questionText: str(fd, "questionText"),
    options: fd.getAll("options").map(String),
    correctOption: str(fd, "correctOption") === "" ? undefined : str(fd, "correctOption"),
    acceptedAnswers: str(fd, "acceptedAnswers"),
    numericValue: str(fd, "numericValue"),
    numericTolerance: str(fd, "numericTolerance"),
    numericUnit: str(fd, "numericUnit"),
    answerText: str(fd, "answerText"),
    explanation: str(fd, "explanation"),
    sourceType: str(fd, "sourceType"),
    verificationStatus: str(fd, "verificationStatus"),
    verificationNotes: str(fd, "verificationNotes"),
    isPublished: fd.get("isPublished") === "on",
    linkPaperId: str(fd, "linkPaperId"),
    linkQuestionNumber: str(fd, "linkQuestionNumber"),
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { errors };
  }
  const res = await saveQuestion(parsed.data, ACTOR);
  if (!res.ok) return { errors: res.errors };
  revalidatePath("/admin/questions");
  redirect(`/admin/questions/${res.id}?saved=1`);
}

export async function deleteQuestionAction(fd: FormData) {
  await requireAdmin();
  const id = Number(str(fd, "id"));
  if (!Number.isInteger(id)) redirect("/admin/questions");
  const res = await deleteQuestion(id);
  redirect(
    res.deleted
      ? withMsg("/admin/questions", "saved", `Question ${id} deleted.`)
      : withMsg(`/admin/questions/${id}`, "saved", "This question is used in generated papers, so it was unpublished instead of deleted."),
  );
}

export async function setStatusAction(fd: FormData) {
  await requireAdmin();
  const id = Number(str(fd, "id"));
  const status = str(fd, "status");
  const back = str(fd, "back") || "/admin/questions";
  if (!Number.isInteger(id) || !["UNVERIFIED", "REJECTED"].includes(status)) redirect(back);
  const db = await getDb();
  // Only downgrades are allowed here; verifying goes through the full edit form and its provenance check.
  await db
    .update(schema.questions)
    .set({
      verificationStatus: status as "UNVERIFIED" | "REJECTED",
      verifiedAt: null,
      verifiedBy: null,
      ...(status === "REJECTED" ? { isPublished: false } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.questions.id, id));
  revalidatePath("/admin/questions");
  redirect(withMsg(back, "saved", `Question ${id} marked ${status.toLowerCase()}.`));
}

export async function addSourceAction(fd: FormData) {
  await requireAdmin();
  const questionId = Number(str(fd, "questionId"));
  const paperId = Number(str(fd, "paperId"));
  const back = `/admin/questions/${questionId}`;
  if (!Number.isInteger(questionId) || !Number.isInteger(paperId) || paperId <= 0) redirect(withMsg(back, "error", "Choose a source paper."));
  const marks = Number(str(fd, "marksInPaper"));
  const err = await addSourceLink(questionId, paperId, str(fd, "questionNumber").trim().slice(0, 20) || null, Number.isInteger(marks) && marks > 0 ? marks : null);
  redirect(err ? withMsg(back, "error", err) : withMsg(back, "saved", "Source linked."));
}

export async function removeSourceAction(fd: FormData) {
  await requireAdmin();
  const questionId = Number(str(fd, "questionId"));
  const paperId = Number(str(fd, "paperId"));
  await removeSourceLink(questionId, paperId);
  redirect(withMsg(`/admin/questions/${questionId}`, "saved", "Source link removed. Verification was rechecked."));
}

// ───────────── Source papers ─────────────

export async function savePaperAction(fd: FormData) {
  await requireAdmin();
  const parsed = paperInputSchema.safeParse({
    id: str(fd, "id") || undefined,
    subjectId: str(fd, "subjectId"),
    title: str(fd, "title"),
    year: str(fd, "year"),
    paperType: str(fd, "paperType"),
    sourceUrl: str(fd, "sourceUrl"),
    sourceNotes: str(fd, "sourceNotes"),
  });
  const back = str(fd, "id") ? `/admin/papers?edit=${str(fd, "id")}` : "/admin/papers";
  if (!parsed.success) redirect(withMsg(back, "error", parsed.error.issues[0]?.message ?? "Check the paper details."));
  const res = await savePaper(parsed.data);
  if (!res.ok) redirect(withMsg(back, "error", res.error));
  revalidatePath("/admin/papers");
  redirect(withMsg("/admin/papers", "saved", `Saved “${parsed.data.title}”.`));
}

export async function deletePaperAction(fd: FormData) {
  await requireAdmin();
  const id = Number(str(fd, "id"));
  if (!Number.isInteger(id)) redirect("/admin/papers");
  const n = await deletePaper(id);
  redirect(withMsg("/admin/papers", "saved", `Paper deleted. ${n} question link${n === 1 ? "" : "s"} removed and rechecked.`));
}

// ───────────── Import ─────────────

export async function createImportAction(fd: FormData) {
  await requireAdmin();
  const subjectId = Number(str(fd, "subjectId"));
  const paperId = Number(str(fd, "paperId")) || null;
  const rawText = str(fd, "rawText").slice(0, 100_000);
  const title = str(fd, "title").trim().slice(0, 200) || "Pasted questions";
  if (!Number.isInteger(subjectId) || subjectId <= 0) redirect(withMsg("/admin/import", "error", "Choose a subject."));
  if (rawText.trim().length < 5) redirect(withMsg("/admin/import", "error", "Paste the question text to import."));
  const res = await createImportBatch({ subjectId, paperId, title, rawText });
  if (!res.ok) redirect(withMsg("/admin/import", "error", res.error));
  redirect(withMsg(`/admin/import/${res.id}`, "saved", `${res.count} questions found. Review each one before publishing.`));
}

export async function approveImportItemAction(fd: FormData) {
  await requireAdmin();
  const batchId = Number(str(fd, "batchId"));
  const itemId = Number(str(fd, "itemId"));
  const back = `/admin/import/${batchId}`;
  const data = await getImportBatch(batchId);
  const item = data?.items.find((i) => i.id === itemId);
  if (!data || !item || item.status !== "PENDING") redirect(withMsg(back, "error", "That item has already been reviewed."));

  const sourceType = z.enum(SOURCE_TYPES).safeParse(str(fd, "sourceType"));
  const checked = fd.get("checkedAgainstSource") === "on";
  const parsed = questionInputSchema.safeParse({
    subjectId: data.batch.subjectId,
    chapterId: str(fd, "chapterId"),
    topicId: "",
    questionType: str(fd, "questionType"),
    marks: str(fd, "marks"),
    difficulty: str(fd, "difficulty") || "MEDIUM",
    questionText: str(fd, "text"),
    options: [],
    acceptedAnswers: "",
    numericValue: "",
    answerText: str(fd, "answerText"),
    explanation: "",
    sourceType: sourceType.success ? sourceType.data : "USER_CONTRIBUTED",
    // Imported questions are only verified when an editor confirms they checked the source paper.
    verificationStatus: checked ? "VERIFIED" : "UNVERIFIED",
    verificationNotes: checked ? `Checked against the source paper during import (batch ${batchId}).` : `Imported in batch ${batchId}; awaiting verification.`,
    isPublished: true,
    linkPaperId: data.paper ? String(data.paper.id) : "",
    linkQuestionNumber: item.questionNumber ?? "",
  });
  if (!parsed.success) redirect(withMsg(`${back}#item-${itemId}`, "error", `Item ${item.position}: ${parsed.error.issues[0]?.message}`));
  if (!["SHORT_ANSWER", "LONG_ANSWER"].includes(parsed.data.questionType)) {
    redirect(
      withMsg(back, "error", `Item ${item.position}: imported questions start as short or long answer. Change the type, and add options or answers, from the question's edit page.`),
    );
  }
  const res = await saveQuestion(parsed.data, ACTOR);
  if (!res.ok) redirect(withMsg(`${back}#item-${itemId}`, "error", `Item ${item.position}: ${Object.values(res.errors)[0]}`));
  await markItemApproved(itemId, res.id);
  redirect(withMsg(back, "saved", `Item ${item.position} published as question ${res.id}${checked ? " (verified)" : " (unverified)"}.`));
}

export async function rejectImportItemAction(fd: FormData) {
  await requireAdmin();
  const batchId = Number(str(fd, "batchId"));
  await rejectImportItem(Number(str(fd, "itemId")));
  redirect(withMsg(`/admin/import/${batchId}`, "saved", "Item rejected."));
}

// ───────────── Demo data ─────────────

export async function purgeDemoAction(fd: FormData) {
  await requireAdmin();
  if (str(fd, "confirm").trim() !== "DELETE DEMO DATA") redirect(withMsg("/admin", "error", "Type DELETE DEMO DATA to confirm."));
  const n = await purgeDemoData();
  revalidatePath("/", "layout");
  redirect(withMsg("/admin", "saved", `All demo questions and demo papers were deleted, along with ${n} generated papers that used them.`));
}
