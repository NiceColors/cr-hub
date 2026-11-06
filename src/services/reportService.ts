import { and, gte, isNotNull, lt, or, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { focusItems, prHistory } from "@/lib/db/schema";
import { buildWeeklyReport, weekRange } from "@/domain/weekly-report";

/** Relatório da semana que começa na segunda `weekStartIso`, a partir do histórico local. */
export function getWeeklyReport(weekStartIso: string, nowMs = Date.now()) {
  const week = weekRange(weekStartIso);
  const start = new Date(week.startMs);
  const end = new Date(week.endMs);

  // PRs vistos antes do fim da semana e que ainda estavam na fila depois do início.
  const rows = db
    .select()
    .from(prHistory)
    .where(
      and(
        lt(prHistory.firstSeenAt, end),
        or(isNull(prHistory.closedAt), gte(prHistory.closedAt, start)),
      ),
    )
    .all();

  const focus = db
    .select()
    .from(focusItems)
    .where(and(isNotNull(focusItems.doneAt), gte(focusItems.doneAt, start), lt(focusItems.doneAt, end)))
    .all();

  return buildWeeklyReport({
    weekStartIso,
    nowMs,
    rows: rows.map((r) => ({
      repoSlug: r.repoSlug,
      prId: r.prId,
      title: r.title,
      url: r.url,
      authorName: r.authorName,
      createdOn: r.createdOn,
      firstSeenAt: r.firstSeenAt.getTime(),
      firstReviewAt: r.firstReviewAt?.getTime() ?? null,
      closedAt: r.closedAt?.getTime() ?? null,
      lastSeenAt: r.lastSeenAt.getTime(),
      changesCycles: r.changesCycles,
      reviewTrackedFromStart: r.reviewTrackedFromStart,
    })),
    focus: focus.map((f) => ({
      repoSlug: f.repoSlug,
      prId: f.prId,
      title: f.title,
      url: f.url,
      timeSpentMs: f.timeSpentMs,
      doneAt: f.doneAt!.getTime(),
    })),
  });
}
