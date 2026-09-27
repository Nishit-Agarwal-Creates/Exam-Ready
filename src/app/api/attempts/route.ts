import { NextResponse } from "next/server";
import { getAttemptSummaries, submitAttempt, submitSchema } from "@/lib/data/attempts";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "The submission was not valid." }, { status: 400 });
  const result = await submitAttempt(parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ id: result.id }, { status: 201 });
}

/** Summaries for the attempt ids this device has stored (My practice). */
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "").split(",").filter(Boolean);
  const rows = await getAttemptSummaries(ids);
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
}
