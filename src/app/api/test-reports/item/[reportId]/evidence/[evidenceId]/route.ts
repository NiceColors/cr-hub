import { NextResponse } from "next/server";
import { badRequest, internalError, jsonError } from "@/lib/api/route-errors";
import { readEvidence, removeEvidence, TestReportError } from "@/services/testReportService";

export const dynamic = "force-dynamic";

async function identity(ctx: { params: Promise<{ reportId: string; evidenceId: string }> }) {
  const { reportId, evidenceId } = await ctx.params;
  const id = Number(reportId);
  const shotId = Number(evidenceId);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(shotId) || shotId <= 0) return null;
  return { reportId: id, evidenceId: shotId };
}

function handle(error: unknown) {
  if (error instanceof TestReportError) return jsonError(error.code, error.message, error.status);
  return internalError(error);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ reportId: string; evidenceId: string }> },
) {
  const parsed = await identity(ctx);
  if (!parsed) return badRequest("id inválido");
  try {
    const file = readEvidence(parsed.reportId, parsed.evidenceId);
    if (!file) return jsonError("NOT_FOUND", "Evidência não encontrada.", 404);
    return new NextResponse(file.bytes, {
      headers: {
        "content-type": file.contentType,
        "cache-control": "private, max-age=86400",
      },
    });
  } catch (error) {
    return internalError(error);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ reportId: string; evidenceId: string }> },
) {
  const parsed = await identity(ctx);
  if (!parsed) return badRequest("id inválido");
  try {
    return NextResponse.json(removeEvidence(parsed.reportId, parsed.evidenceId));
  } catch (error) {
    return handle(error);
  }
}
