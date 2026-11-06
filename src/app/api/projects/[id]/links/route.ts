import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, jsonError } from "@/lib/api/route-errors";
import { linkPullRequest, ProjectError, unlinkPullRequest } from "@/services/projectService";

const postSchema = z.object({
  repoUuid: z.string().min(1),
  prId: z.number().int().positive(),
  title: z.string().min(1).max(500),
  url: z.string().url(),
  repoSlug: z.string().min(1).max(200),
  authorName: z.string().max(200).nullable().optional(),
});

async function parseId(ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function handle(fn: () => void) {
  try {
    fn();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ProjectError) return jsonError(err.code, err.message, err.status);
    throw err;
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = await parseId(ctx);
  if (id === null) return badRequest("id inválido");
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  return handle(() => linkPullRequest(id, parsed.data));
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = await parseId(ctx);
  if (id === null) return badRequest("id inválido");
  const prKey = new URL(req.url).searchParams.get("prKey");
  if (!prKey) return badRequest("prKey obrigatório");
  return handle(() => unlinkPullRequest(id, prKey));
}
