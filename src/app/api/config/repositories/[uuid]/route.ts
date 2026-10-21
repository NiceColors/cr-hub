import { NextResponse } from "next/server";
import { z } from "zod";
import { patchRepository } from "@/services/configService";

const patchSchema = z.object({
  monitored: z.boolean().optional(),
  minApprovals: z.number().int().min(0).max(20).optional(),
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
  patchRepository(uuid, parsed.data);
  return NextResponse.json({ ok: true });
}

