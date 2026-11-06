import { db } from "@/lib/db";
import { prDiffstats } from "@/lib/db/schema";
import {
  dayBuckets,
  periodComparison,
  queueSeries,
  recordingSince,
  throughputSeries,
  type PeriodComparison,
} from "@/domain/dashboard";
import {
  buildPeopleLoad,
  buildProjectProgress,
  buildTeamHealth,
  countRisks,
  deliveryFunnel,
  prRisks,
  rankAttention,
  riskScore,
  type DeliveryFunnel,
  type LeadPullRequest,
  type PersonLoad,
  type ProjectProgress,
  type RiskCounts,
  type RiskKind,
  type TeamHealth,
} from "@/domain/lead";
import {
  isSnoozeActive,
  prKey,
  resolveTeamScope,
  sizeBucket,
  type SizeBucket,
} from "@/domain/pull-request";
import { listMonitoredMembers, listTeams, type Team } from "@/services/configService";
import { loadContext, scopeRows } from "@/services/dashboardService";
import { peekBuildState } from "@/services/pullRequestDetailsService";
import { listProjects } from "@/services/projectService";
import { listPullRequests } from "@/services/pullRequestsService";

export interface LeadOverview {
  fetchedAt: string;
  days: string[];
  /** Repositórios que falharam na última busca. */
  failedRepos: number;
  rateLimited: boolean;
  summary: {
    counts: RiskCounts;
    ageBands: { normal: number; warning: number; critical: number };
    stages: { waiting: number; inReview: number; changesRequested: number; approved: number };
    period: PeriodComparison;
    funnel: DeliveryFunnel;
    series: { open: number[]; critical: number[]; closed: number[]; opened: number[] };
  };
  attention: LeadPullRequest[];
  pullRequests: LeadPullRequest[];
  teams: TeamHealth[];
  projects: ProjectProgress[];
  people: PersonLoad[];
}

function loadSizes() {
  const sizes = new Map<string, SizeBucket>();
  for (const row of db.select().from(prDiffstats).all()) {
    sizes.set(prKey(row.repoUuid, row.prId), sizeBucket(row.linesAdded + row.linesRemoved));
  }
  return sizes;
}

function teamScope(team: Team, monitoredRepos: { uuid: string }[]) {
  return {
    members: new Set(team.memberUuids),
    repos: new Set(resolveTeamScope(team, monitoredRepos)),
  };
}

/** Visão operacional do líder: fila ao vivo cruzada com histórico, times e projetos. */
export async function getLeadOverview(opts: {
  teamId: number | null;
  days: number;
  nowMs?: number;
}): Promise<LeadOverview> {
  const live = await listPullRequests({});
  const nowMs = opts.nowMs ?? Date.now();
  const ctx = loadContext();
  const teams = listTeams().toSorted((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const scopes = new Map(teams.map((t) => [t.id, teamScope(t, ctx.monitoredRepos)]));
  const team = opts.teamId ? (teams.find((t) => t.id === opts.teamId) ?? null) : null;
  const unknownTeam = opts.teamId !== null && team === null;

  const historyByKey = new Map(ctx.history.map((row) => [row.prKey, row]));
  const projects = listProjects();
  const projectsByKey = new Map<string, number[]>();
  for (const project of projects) {
    for (const link of project.pullRequests) {
      projectsByKey.set(link.prKey, [...(projectsByKey.get(link.prKey) ?? []), project.id]);
    }
  }
  const sizes = loadSizes();

  const allPrs: LeadPullRequest[] = live.pullRequests
    .filter((pr) => pr.authorMonitored)
    .map((pr) => {
      const key = prKey(pr.repository.uuid, pr.id);
      const history = historyByKey.get(key);
      const build = peekBuildState(key, pr.updatedOn);
      const size = sizes.get(key) ?? null;
      const changesCycles = history?.changesCycles ?? 0;
      const risks = prRisks(
        {
          ageBand: pr.ageBand,
          reviewers: pr.reviewers,
          reviewState: pr.reviewState,
          updatedOn: pr.updatedOn,
          approvedAt: history?.approvedAt ?? null,
          changesCycles,
          build,
          size,
        },
        nowMs,
      );
      return {
        key,
        id: pr.id,
        title: pr.title,
        url: pr.url,
        repository: pr.repository,
        author: pr.author,
        createdOn: pr.createdOn,
        updatedOn: pr.updatedOn,
        reviewState: pr.reviewState,
        ageBand: pr.ageBand,
        approvals: pr.approvals,
        minApprovals: pr.minApprovals,
        reviewers: pr.reviewers,
        jiraKey: pr.jiraKey,
        destinationBranch: pr.destinationBranch,
        snoozed: isSnoozeActive(pr.snooze, pr.updatedOn, nowMs),
        build,
        size,
        changesCycles,
        teamIds: teams
          .filter((t) => {
            const scope = scopes.get(t.id)!;
            return scope.members.has(pr.author.uuid) && scope.repos.has(pr.repository.uuid);
          })
          .map((t) => t.id),
        projectIds: projectsByKey.get(key) ?? [],
        risks,
        score: riskScore(risks),
      };
    });

  const inScope = (pr: LeadPullRequest) => !team || pr.teamIds.includes(team.id);
  const prs = unknownTeam ? [] : allPrs.filter(inScope).toSorted((a, b) => b.score - a.score);

  const rows = unknownTeam ? [] : scopeRows(ctx, team);
  const buckets = dayBuckets(recordingSince(scopeRows(ctx, null)), nowMs, opts.days);
  const first = buckets[0];
  const last = buckets.at(-1);
  const queue = queueSeries(rows, buckets, ctx.slaByRepo);
  const throughput = throughputSeries(rows, buckets);

  const ageBands = { normal: 0, warning: 0, critical: 0 };
  const stages = { waiting: 0, inReview: 0, changesRequested: 0, approved: 0 };
  for (const pr of prs) {
    ageBands[pr.ageBand]++;
    if (pr.reviewState === "waiting") stages.waiting++;
    else if (pr.reviewState === "in_review") stages.inReview++;
    else if (pr.reviewState === "changes_requested") stages.changesRequested++;
    else stages.approved++;
  }

  const risksByKey = new Map<string, RiskKind[]>(allPrs.map((pr) => [pr.key, pr.risks]));
  const memberRows = listMonitoredMembers()
    .filter((m) => !team || team.memberUuids.includes(m.uuid))
    .map((m) => ({ uuid: m.uuid, displayName: m.displayName, avatarUrl: m.avatarUrl }));

  return {
    fetchedAt: live.fetchedAt,
    days: buckets.map((b) => b.day),
    failedRepos: live.errors.length,
    rateLimited: Boolean(live.rateLimit),
    summary: {
      counts: countRisks(prs),
      ageBands,
      stages,
      period: periodComparison(rows, buckets, recordingSince(rows)),
      funnel: first && last ? deliveryFunnel(rows, first.startMs, last.cutoffMs) : deliveryFunnel([], 0, 0),
      series: {
        open: queue.map((p) => p.total),
        critical: queue.map((p) => p.critical),
        closed: throughput.map((p) => p.closed),
        opened: throughput.map((p) => p.opened),
      },
    },
    attention: rankAttention(prs),
    pullRequests: prs,
    teams: teams.map((t) =>
      buildTeamHealth(
        t,
        allPrs.filter((pr) => pr.teamIds.includes(t.id)),
        scopeRows(ctx, t),
        buckets,
        ctx.slaByRepo,
      ),
    ),
    projects: buildProjectProgress(
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        kind: p.kind,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        links: p.pullRequests,
      })),
      rows,
      risksByKey,
      buckets,
      { scoped: team !== null, nowMs },
    ),
    people: buildPeopleLoad(prs, memberRows),
  };
}
