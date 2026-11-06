import { NextResponse } from "next/server";
import { z } from "zod";
import { prKey } from "@/domain/pull-request";
import { REVIEW_SCOPES } from "@/domain/test-report";
import { badRequest, internalError, jsonError } from "@/lib/api/route-errors";
import { createTestReport, listTestReports, TestReportError } from "@/services/testReportService";

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

const createSchema = z.object({
  scope: z.enum(REVIEW_SCOPES),
  title: z.string().trim().max(500),
  subjects: z.array(subjectSchema).min(1).max(40),
  projectId: z.number().int().positive().nullable().optional(),
});

function handle(error: unknown) {
  if (error instanceof TestReportError) return jsonError(error.code, error.message, error.status);
  return internalError(error);
}

export async function GET() {
  try {
    return NextResponse.json(listTestReports());
  } catch (error) {
    return handle(error);
  }
}

export async function POST(req: Request) {
  const body = createSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return badRequest(body.error.message);
  try {
    return NextResponse.json(createTestReport(body.data), { status: 201 });
  } catch (error) {
    return handle(error);
  }
}
