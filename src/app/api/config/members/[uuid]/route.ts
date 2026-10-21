import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteMember, patchMember } from "@/services/configService";

const patchSchema = z.object({
  monitored: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: parsed.error.message } },
      { status: 400 },
    );
  }
  patchMember(uuid, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await ctx.params;
  deleteMember(uuid);
  return NextResponse.json({ ok: true });
}

