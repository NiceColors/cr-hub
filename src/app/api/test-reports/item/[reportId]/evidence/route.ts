import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, internalError, jsonError } from "@/lib/api/route-errors";
import { addEvidence, TestReportError } from "@/services/testReportService";

export const dynamic = "force-dynamic";

const fieldsSchema = z.object({
  caption: z.string().max(240).optional(),
});

function handle(error: unknown) {
  if (error instanceof TestReportError) return jsonError(error.code, error.message, error.status);
  return internalError(error);
}

export async function POST(req: Request, ctx: { params: Promise<{ reportId: string }> }) {
  const { reportId: raw } = await ctx.params;
  const reportId = Number(raw);
  if (!Number.isInteger(reportId) || reportId <= 0) return badRequest("id inválido");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return badRequest("Arquivo ausente.");
  const fields = fieldsSchema.safeParse({ caption: form?.get("caption") ?? "" });
  if (!fields.success) return badRequest(fields.error.message);

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
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
