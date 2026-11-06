import { NextResponse } from "next/server";
import { z } from "zod";
import { PROJECT_KINDS } from "@/domain/project";
import { badRequest, jsonError } from "@/lib/api/route-errors";
import { createProject, listProjects, ProjectError } from "@/services/projectService";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  name: z.string(),
  kind: z.enum(PROJECT_KINDS),
  notes: z.string().max(500).nullable().optional(),
});

function handle<T>(fn: () => T) {
  try {
    return NextResponse.json(fn());
  } catch (err) {
    if (err instanceof ProjectError) return jsonError(err.code, err.message, err.status);
    throw err;
  }
}

export async function GET() {
  return handle(() => ({ projects: listProjects() }));
}

export async function POST(req: Request) {
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  return handle(() => ({ project: createProject(parsed.data) }));
}
