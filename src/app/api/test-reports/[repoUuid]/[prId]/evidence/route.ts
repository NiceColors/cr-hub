import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, internalError, jsonError } from "@/lib/api/route-errors";
import {
  addEvidence,
  createTestReport,
  latestReportIdForPullRequest,
  TestReportError,
} from "@/services/testReportService";
import { prKey } from "@/domain/pull-request";

export const dynamic = "force-dynamic";

const fieldsSchema = z.object({
  title: z.string().trim().min(1).max(500),
  url: z.string().url(),
  repoSlug: z.string().trim().min(1).max(200),
  caption: z.string().max(240).optional(),
});

function handle(error: unknown) {
  if (error instanceof TestReportError) return jsonError(error.code, error.message, error.status);
  return internalError(error);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ repoUuid: string; prId: string }> },
) {
  const { repoUuid, prId } = await ctx.params;
  const id = Number(prId);
  if (!Number.isInteger(id)) return badRequest("id inválido");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return badRequest("Arquivo ausente.");
  const fields = fieldsSchema.safeParse({
    title: form?.get("title"),
    url: form?.get("url"),
    repoSlug: form?.get("repoSlug"),
    caption: form?.get("caption") ?? "",
  });
  if (!fields.success) return badRequest(fields.error.message);

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const repo = decodeURIComponent(repoUuid);
    let reportId = latestReportIdForPullRequest(repo, id);
    if (reportId === null) {
      const created = createTestReport({
        scope: "cr",
        title: fields.data.title,
        subjects: [
          {
            prKey: prKey(repo, id),
            repoUuid: repo,
            prId: id,
            title: fields.data.title,
            url: fields.data.url,
            repoSlug: fields.data.repoSlug,
          },
        ],
      });
      reportId = created.report?.id ?? null;
    }
    if (reportId === null) return badRequest("Revisão não encontrada.");
    return NextResponse.json(
      addEvidence({
        reportId,
        caption: fields.data.caption ?? "",
        contentType: file.type,
        bytes,
      }),
    );
  } catch (error) {
    return handle(error);
  }
}
