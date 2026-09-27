import { NextResponse } from "next/server";
import { getPaper } from "@/lib/data/papers";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const withAnswers = new URL(request.url).searchParams.get("answers") === "1";
  const paper = await getPaper(id, withAnswers);
  if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  return NextResponse.json(paper, { headers: { "Cache-Control": "private, max-age=60" } });
}
