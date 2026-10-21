import { NextResponse } from "next/server";
import { z } from "zod";
import { createTeam, listTeams } from "@/services/configService";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  name: z.string().min(1),
  memberUuids: z.array(z.string().min(1)).default([]),
  repositoryUuids: z.array(z.string().min(1)).default([]),
});

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

