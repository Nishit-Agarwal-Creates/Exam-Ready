import { NextResponse } from "next/server";
import { attemptIdSchema, saveSelfReview, selfReviewSchema } from "@/lib/data/attempts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!attemptIdSchema.safeParse(id).success) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  const parsed = selfReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Those marks aren't valid." }, { status: 400 });
  const res = await saveSelfReview(id, parsed.data.marks);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 404 });
  return NextResponse.json({ ok: true });
}
