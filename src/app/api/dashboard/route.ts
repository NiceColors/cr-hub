import { NextResponse } from "next/server";
import { parseDashboardQuery } from "@/lib/api/dashboard-query";
import { badRequest, internalError } from "@/lib/api/route-errors";
import { getDashboard } from "@/services/dashboardService";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const parsed = parseDashboardQuery(req);
  if (!parsed.success) return badRequest(parsed.error.message);
  try {
    return NextResponse.json(getDashboard(parsed.data));
  } catch (err) {
    return internalError(err);
  }
}
