import { NextResponse } from "next/server";
import { badRequest } from "@/lib/api/route-errors";
import { isIsoDate } from "@/domain/rotation";
import { weekStartOf } from "@/domain/weekly-report";
import { getWeeklyReport } from "@/services/reportService";

export const dynamic = "force-dynamic";

/** `?week=AAAA-MM-DD` (qualquer dia da semana); sem parâmetro, a semana atual. */
export async function GET(req: Request) {
  const week = new URL(req.url).searchParams.get("week");
  if (week && !isIsoDate(week)) return badRequest("Use week=AAAA-MM-DD");
  const [y, m, d] = (week ?? "").split("-").map(Number);
  const reference = week ? new Date(y!, m! - 1, d!) : new Date();
  const weekStartIso = weekStartOf(reference);
  return NextResponse.json({ weekStart: weekStartIso, ...getWeeklyReport(weekStartIso) });
}
