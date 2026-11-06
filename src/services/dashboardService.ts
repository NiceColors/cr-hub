import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { members, prHistory, repositories } from "@/lib/db/schema";
import {
  buildDashboard,
  dayBuckets,
  recordingSince,
  type DashboardData,
  type HistoryRow,
} from "@/domain/dashboard";
import { buildFeatureBoard, type FeatureBoard } from "@/domain/dashboard-features";
import { buildTeamComparison, type TeamComparison } from "@/domain/dashboard-teams";
import { DEFAULT_SLA, resolveTeamScope, type Sla } from "@/domain/pull-request";
import { getTeam, listTeams, type Team } from "@/services/configService";
import { listProjects } from "@/services/projectService";

type DashboardOptions = { teamId: number | null; days: number; nowMs?: number };

export function loadContext() {
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
  const monitoredAuthors = new Set(
    db
      .select({ uuid: members.uuid })
      .from(members)
      .where(eq(members.monitored, true))
      .all()
      .map((m) => m.uuid),
  );
  const history: HistoryRow[] = db
    .select({
      prKey: prHistory.prKey,
      repoUuid: prHistory.repoUuid,
      authorUuid: prHistory.authorUuid,
      createdOn: prHistory.createdOn,
      firstSeenAt: prHistory.firstSeenAt,
      firstReviewAt: prHistory.firstReviewAt,
      approvedAt: prHistory.approvedAt,
      closedAt: prHistory.closedAt,
      changesCycles: prHistory.changesCycles,
    })
    .from(prHistory)
    .all()
    .map((r) => ({
      ...r,
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
  return {
    history,
    monitoredAuthors,
    monitoredRepos: repoRows.filter((r) => r.monitored),
    slaByRepo,
    repoNames: new Map(repoRows.map((r) => [r.uuid, r.name])),
  };
}

export type DashboardContext = ReturnType<typeof loadContext>;
type Context = DashboardContext;

/**
 * Como a fila: só PRs de autores monitorados; com time, os membros e os
 * repositórios do time.
 */
export function scopeRows(ctx: Context, team: Team | null) {
  if (!team) return ctx.history.filter((r) => ctx.monitoredAuthors.has(r.authorUuid));
  const authors = new Set(team.memberUuids);
  const repos = new Set(resolveTeamScope(team, ctx.monitoredRepos));
  return ctx.history.filter((r) => authors.has(r.authorUuid) && repos.has(r.repoUuid));
}

/** Time pedido, ou `undefined` se o id não existe mais. */
function resolveTeam(teamId: number | null): Team | null | undefined {
  if (!teamId) return null;
  return getTeam(teamId) ?? undefined;
}

/** Séries do dashboard a partir de `pr_history`. */
export function getDashboard(opts: DashboardOptions): DashboardData {
  const ctx = loadContext();
  const team = resolveTeam(opts.teamId);
  return buildDashboard(team === undefined ? [] : scopeRows(ctx, team), {
    nowMs: opts.nowMs ?? Date.now(),
    windowDays: opts.days,
    slaByRepo: ctx.slaByRepo,
    repoNames: ctx.repoNames,
  });
}

/** Todos os times lado a lado, nos mesmos dias. */
export function getTeamComparison(opts: Omit<DashboardOptions, "teamId">): {
  days: string[];
  teams: TeamComparison[];
} {
  const ctx = loadContext();
  const buckets = dayBuckets(recordingSince(scopeRows(ctx, null)), opts.nowMs ?? Date.now(), opts.days);
  const teams = listTeams()
    .toSorted((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((team) => ({
      id: team.id,
      name: team.name,
      members: team.memberUuids.length,
      rows: scopeRows(ctx, team),
    }));
  return {
    days: buckets.map((b) => b.day),
    teams: buildTeamComparison(teams, buckets, ctx.slaByRepo),
  };
}

/** Projetos e features com o andamento dos CRs vinculados. */
export function getFeatureBoard(opts: DashboardOptions): FeatureBoard & { days: string[] } {
  const ctx = loadContext();
  const team = resolveTeam(opts.teamId);
  const rows = team === undefined ? [] : scopeRows(ctx, team);
  const nowMs = opts.nowMs ?? Date.now();
  const buckets = dayBuckets(recordingSince(rows), nowMs, opts.days);
  const features = listProjects().map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    links: p.pullRequests,
  }));
  return {
    days: buckets.map((b) => b.day),
    ...buildFeatureBoard(features, rows, buckets, { scoped: opts.teamId !== null, nowMs }),
  };
}
