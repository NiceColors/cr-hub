import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, internalError, jsonError } from "@/lib/api/route-errors";
import { FINDING_KINDS, TEST_OUTCOMES } from "@/domain/test-report";
import {
  getTestReportForPullRequest,
  saveTestReportForPullRequest,
  TestReportError,
} from "@/services/testReportService";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  title: z.string().trim().min(1).max(500),
  url: z.string().url(),
  repoSlug: z.string().trim().min(1).max(200),
  outcome: z.enum(TEST_OUTCOMES),
  howTested: z.string().max(8000),
  findings: z
    .array(
      z.object({
        id: z.number().int().positive().nullable(),
        tempId: z.string().min(1).max(80),
        kind: z.enum(FINDING_KINDS),
        body: z.string().max(2000),
      }),
    )
    .max(40),
  evidence: z
    .array(
      z.object({
        id: z.number().int().positive(),
        caption: z.string().max(240),
        findingId: z.number().int().positive().nullable(),
        findingTempId: z.string().max(80).nullable(),
      }),
    )
    .max(8),
});

async function identity(ctx: { params: Promise<{ repoUuid: string; prId: string }> }) {
  const { repoUuid, prId } = await ctx.params;
  const id = Number(prId);
  if (!Number.isInteger(id)) return null;
  return { repoUuid: decodeURIComponent(repoUuid), prId: id };
}

function handle(error: unknown) {
  if (error instanceof TestReportError) return jsonError(error.code, error.message, error.status);
  return internalError(error);
}

export async function GET(_req: Request, ctx: { params: Promise<{ repoUuid: string; prId: string }> }) {
  const parsed = await identity(ctx);
  if (!parsed) return badRequest("id inválido");
  try {
    return NextResponse.json(getTestReportForPullRequest(parsed.repoUuid, parsed.prId));
  } catch (error) {
    return handle(error);
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ repoUuid: string; prId: string }> }) {
  const parsed = await identity(ctx);
  if (!parsed) return badRequest("id inválido");
  const body = putSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return badRequest(body.error.message);
  try {
    return NextResponse.json(saveTestReportForPullRequest({ ...parsed, ...body.data }));
  } catch (error) {
    return handle(error);
  }
}
