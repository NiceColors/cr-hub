import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { members, prHistory, repositories } from "@/lib/db/schema";
import { buildDashboard, type DashboardData, type HistoryRow } from "@/domain/dashboard";
import { DEFAULT_SLA, resolveTeamScope, type Sla } from "@/domain/pull-request";
import { getTeam } from "@/services/configService";

const WINDOW_DAYS = 30;

/**
 * Séries do dashboard a partir de `pr_history`. Como a fila, só entram PRs de
 * autores monitorados; com time, os membros e os repositórios do time.
 */
export function getDashboard(opts: { teamId: number | null; nowMs?: number }): DashboardData {
  const repoRows = db
    .select({
      uuid: repositories.uuid,
      name: repositories.name,
      monitored: repositories.monitored,
      slaWarningHours: repositories.slaWarningHours,
      slaCriticalHours: repositories.slaCriticalHours,
    })
    .from(repositories)
    .all();

  const team = opts.teamId ? getTeam(opts.teamId) : null;
  const authors = team
    ? new Set(team.memberUuids)
    : new Set(
        db
          .select({ uuid: members.uuid })
          .from(members)
          .where(eq(members.monitored, true))
          .all()
          .map((m) => m.uuid),
      );
  const scopeRepos = team
    ? new Set(resolveTeamScope(team, repoRows.filter((r) => r.monitored)))
    : null;

  const rows: HistoryRow[] = db
    .select({
      repoUuid: prHistory.repoUuid,
      authorUuid: prHistory.authorUuid,
      createdOn: prHistory.createdOn,
      firstSeenAt: prHistory.firstSeenAt,
      firstReviewAt: prHistory.firstReviewAt,
      approvedAt: prHistory.approvedAt,
      closedAt: prHistory.closedAt,
    })
    .from(prHistory)
    .all()
    .filter(
      (r) =>
        (!opts.teamId || team !== null) &&
        authors.has(r.authorUuid) &&
        (!scopeRepos || scopeRepos.has(r.repoUuid)),
    )
    .map((r) => ({
      repoUuid: r.repoUuid,
      createdOn: r.createdOn,
      firstSeenAt: r.firstSeenAt.getTime(),
      firstReviewAt: r.firstReviewAt?.getTime() ?? null,
      approvedAt: r.approvedAt?.getTime() ?? null,
      closedAt: r.closedAt?.getTime() ?? null,
    }));

  const slaByRepo = new Map<string, Sla>(
    repoRows.map((r) => [
      r.uuid,
      {
        warningHours: r.slaWarningHours ?? DEFAULT_SLA.warningHours,
        criticalHours: r.slaCriticalHours ?? DEFAULT_SLA.criticalHours,
      },
    ]),
  );
  const repoNames = new Map(repoRows.map((r) => [r.uuid, r.name]));

  return buildDashboard(rows, {
    nowMs: opts.nowMs ?? Date.now(),
    windowDays: WINDOW_DAYS,
    slaByRepo,
    repoNames,
  });
}
