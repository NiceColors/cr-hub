import { NextResponse } from "next/server";
import { teamInputSchema as postSchema } from "@/lib/api/team-schema";
import { createTeam, listTeams } from "@/services/configService";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ teams: listTeams() });
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: parsed.error.message } },
      { status: 400 },
    );
  }
  createTeam(parsed.data);
  return NextResponse.json({ ok: true });
}

