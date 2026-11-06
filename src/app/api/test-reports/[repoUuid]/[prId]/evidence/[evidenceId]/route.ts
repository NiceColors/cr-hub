import { NextResponse } from "next/server";
import { badRequest, internalError, jsonError } from "@/lib/api/route-errors";
import {
  readEvidenceForPullRequest,
  removeEvidenceForPullRequest,
  TestReportError,
} from "@/services/testReportService";

export const dynamic = "force-dynamic";

async function identity(ctx: {
  params: Promise<{ repoUuid: string; prId: string; evidenceId: string }>;
}) {
  const { repoUuid, prId, evidenceId } = await ctx.params;
  const id = Number(prId);
  const shotId = Number(evidenceId);
  if (!Number.isInteger(id) || !Number.isInteger(shotId)) return null;
  return { repoUuid: decodeURIComponent(repoUuid), prId: id, evidenceId: shotId };
}

function handle(error: unknown) {
  if (error instanceof TestReportError) return jsonError(error.code, error.message, error.status);
  return internalError(error);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ repoUuid: string; prId: string; evidenceId: string }> },
) {
  const parsed = await identity(ctx);
  if (!parsed) return badRequest("id inválido");
  try {
    const file = readEvidenceForPullRequest(parsed.repoUuid, parsed.prId, parsed.evidenceId);
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
  ctx: { params: Promise<{ repoUuid: string; prId: string; evidenceId: string }> },
) {
  const parsed = await identity(ctx);
  if (!parsed) return badRequest("id inválido");
  try {
    return NextResponse.json(
      removeEvidenceForPullRequest(parsed.repoUuid, parsed.prId, parsed.evidenceId),
    );
  } catch (error) {
    return handle(error);
  }
}
