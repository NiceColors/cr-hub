import { NextResponse } from "next/server";
import { z } from "zod";
import { PROJECT_KINDS, PROJECT_STATUSES } from "@/domain/project";
import { badRequest, jsonError } from "@/lib/api/route-errors";
import { deleteProject, ProjectError, updateProject } from "@/services/projectService";

const patchSchema = z.object({
  name: z.string().optional(),
  kind: z.enum(PROJECT_KINDS).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  notes: z.string().max(500).nullable().optional(),
});

async function parseId(ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function handle<T>(fn: () => T) {
  try {
    return NextResponse.json(fn());
  } catch (err) {
    if (err instanceof ProjectError) return jsonError(err.code, err.message, err.status);
    throw err;
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = await parseId(ctx);
  if (id === null) return badRequest("id inválido");
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  return handle(() => ({ project: updateProject(id, parsed.data) }));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = await parseId(ctx);
  if (id === null) return badRequest("id inválido");
  return handle(() => {
    deleteProject(id);
    return { ok: true };
  });
}
