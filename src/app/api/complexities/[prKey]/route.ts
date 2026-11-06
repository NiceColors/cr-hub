import { NextResponse } from "next/server";
import { z } from "zod";
import { COMPLEXITIES } from "@/domain/pull-request";
import { badRequest } from "@/lib/api/route-errors";
import { deleteComplexity, setComplexity } from "@/services/complexityService";

const putSchema = z.object({
  complexity: z.enum(COMPLEXITIES),
});

const PR_KEY_RE = /^\{[^}]+\}:\d+$/;

export async function PUT(req: Request, ctx: { params: Promise<{ prKey: string }> }) {
  const { prKey } = await ctx.params;
  const key = decodeURIComponent(prKey);
  if (!PR_KEY_RE.test(key)) return badRequest("prKey inválido");
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  setComplexity(key, parsed.data.complexity);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ prKey: string }> }) {
  const { prKey } = await ctx.params;
  const key = decodeURIComponent(prKey);
  if (!PR_KEY_RE.test(key)) return badRequest("prKey inválido");
  deleteComplexity(key);
  return NextResponse.json({ ok: true });
}
