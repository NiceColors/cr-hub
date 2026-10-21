import { NextResponse } from "next/server";
import { z } from "zod";
import { addManualMember, listMembers } from "@/services/configService";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  uuid: z.string().min(1),
  nickname: z.string().optional().nullable(),
  displayName: z.string().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

export async function GET() {
  return NextResponse.json({ members: listMembers() });
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
  addManualMember(parsed.data);
  return NextResponse.json({ ok: true });
}

