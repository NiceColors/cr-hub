import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest } from "@/lib/api/route-errors";
import { deleteSnooze, setSnooze } from "@/services/snoozeService";

const putSchema = z.object({
  reason: z.string().trim().min(1).max(200),
  kind: z.enum(["24h", "tomorrow", "until_change"]),
  updatedOn: z.string().min(1),
});

const PR_KEY_RE = /^\{[^}]+\}:\d+$/;

export async function PUT(req: Request, ctx: { params: Promise<{ prKey: string }> }) {
  const { prKey } = await ctx.params;
  const key = decodeURIComponent(prKey);
  if (!PR_KEY_RE.test(key)) return badRequest("prKey inválido");
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  setSnooze({ prKey: key, ...parsed.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ prKey: string }> }) {
  const { prKey } = await ctx.params;
  deleteSnooze(decodeURIComponent(prKey));
  return NextResponse.json({ ok: true });
}
