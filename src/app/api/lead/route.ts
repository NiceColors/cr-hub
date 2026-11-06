import { NextResponse } from "next/server";
import { parseDashboardQuery } from "@/lib/api/dashboard-query";
import { badRequest, internalError, jsonError } from "@/lib/api/route-errors";
import { ENABLE_LEAD_VIEW } from "@/lib/features";
import { getLeadOverview } from "@/services/leadService";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!ENABLE_LEAD_VIEW) return jsonError("NOT_FOUND", "Não encontrado", 404);
  const parsed = parseDashboardQuery(req);
  if (!parsed.success) return badRequest(parsed.error.message);
  try {
    return NextResponse.json(await getLeadOverview(parsed.data));
  } catch (err) {
    return internalError(err);
  }
}
