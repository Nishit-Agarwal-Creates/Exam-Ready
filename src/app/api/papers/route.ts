import { NextResponse } from "next/server";
import { createPaper, paperRequestSchema } from "@/lib/data/papers";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = paperRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const result = await createPaper(parsed.data);
  if (result.ok) return NextResponse.json({ id: result.id, stages: result.stages }, { status: 201 });
  if ("failure" in result) return NextResponse.json({ failure: result.failure }, { status: 422 });
  return NextResponse.json({ error: result.error }, { status: 400 });
}
