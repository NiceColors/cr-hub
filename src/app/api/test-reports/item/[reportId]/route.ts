import { NextResponse } from "next/server";
import { z } from "zod";
import { prKey } from "@/domain/pull-request";
import { FINDING_KINDS, TEST_OUTCOMES } from "@/domain/test-report";
import { badRequest, internalError, jsonError } from "@/lib/api/route-errors";
import { getTestReport, saveTestReport, TestReportError } from "@/services/testReportService";

export const dynamic = "force-dynamic";

const subjectSchema = z
  .object({
    prKey: z.string().min(3),
    repoUuid: z.string().min(1),
    prId: z.number().int().positive(),
    title: z.string().trim().min(1).max(500),
    url: z.string().url(),
    repoSlug: z.string().trim().min(1).max(200),
  })
  .refine((subject) => subject.prKey === prKey(subject.repoUuid, subject.prId), {
    message: "CR inválido.",
  });

const putSchema = z.object({
  title: z.string().trim().min(1).max(500),
  url: z.string().max(2000),
  repoSlug: z.string().max(200),
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
  subjects: z.array(subjectSchema).max(40).optional(),
});

async function reportId(ctx: { params: Promise<{ reportId: string }> }) {
  const { reportId: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function handle(error: unknown) {
  if (error instanceof TestReportError) return jsonError(error.code, error.message, error.status);
  return internalError(error);
}

export async function GET(_req: Request, ctx: { params: Promise<{ reportId: string }> }) {
  const id = await reportId(ctx);
  if (!id) return badRequest("id inválido");
  try {
    const data = getTestReport(id);
    if (!data.report) return jsonError("NOT_FOUND", "Revisão não encontrada.", 404);
    return NextResponse.json(data);
  } catch (error) {
    return handle(error);
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ reportId: string }> }) {
  const id = await reportId(ctx);
  if (!id) return badRequest("id inválido");
  const body = putSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return badRequest(body.error.message);
  try {
    return NextResponse.json(saveTestReport(id, body.data));
  } catch (error) {
    return handle(error);
  }
}
