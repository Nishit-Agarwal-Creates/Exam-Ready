import { NextResponse } from "next/server";
import { estimate, paperRequestSchema } from "@/lib/data/papers";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = paperRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const result = await estimate(parsed.data);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
