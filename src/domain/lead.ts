import {
  queueSeries,
  throughputSeries,
  windowStats,
  type DayBucket,
  type HistoryRow,
  type WindowStats,
} from "@/domain/dashboard";
import {
  buildFeatureBoard,
  stageAt,
  type FeatureInput,
  type FeatureSummary,
  type PullRequestStage,
} from "@/domain/dashboard-features";
import {
  reviewLoadByMember,
  type AgeBand,
  type BuildState,
  type PullRequest,
  type ReviewState,
  type Sla,
  type SizeBucket,
} from "@/domain/pull-request";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Limites dos sinais de risco e de projeto parado. */
export const LEAD_LIMITS = {
  staleHours: 48,
  approvedIdleHours: 24,
  changesLoopCycles: 2,
  projectIdleDays: 5,
} as const;

// --- Sinais de risco por PR ---------------------------------------------------

/** Na ordem de gravidade: é a ordem em que aparecem nos chips. */
export const RISK_KINDS = [
  "sla_critical",
  "build_failed",
  "sla_warning",
  "no_reviewers",
  "approved_not_merged",
  "changes_loop",
  "stale",
  "large",
] as const;
export type RiskKind = (typeof RISK_KINDS)[number];

export type RiskSeverity = "critical" | "warning" | "info";

export const RISK_SEVERITY: Record<RiskKind, RiskSeverity> = {
  sla_critical: "critical",
  build_failed: "critical",
  sla_warning: "warning",
  no_reviewers: "warning",
  approved_not_merged: "warning",
  changes_loop: "warning",
  stale: "warning",
  large: "info",
};

export const RISK_LABELS: Record<RiskKind, string> = {
  sla_critical: "SLA crítico",
  build_failed: "Build falhou",
  sla_warning: "SLA em atenção",
  no_reviewers: "Sem revisor",
  approved_not_merged: "Aprovado parado",
  changes_loop: "Idas e voltas",
  stale: "Sem atividade",
  large: "PR muito grande",
};

export const RISK_DESCRIPTIONS: Record<RiskKind, string> = {
  sla_critical: "Passou do SLA crítico do repositório.",
  build_failed: "O último build do PR falhou.",
  sla_warning: "Passou do SLA de atenção do repositório.",
  no_reviewers: "Ninguém foi indicado para revisar.",
  approved_not_merged: `Aprovado há mais de ${LEAD_LIMITS.approvedIdleHours}h e ainda aberto.`,
  changes_loop: `Teve ${LEAD_LIMITS.changesLoopCycles} ou mais pedidos de mudança.`,
  stale: `Sem atualização há mais de ${LEAD_LIMITS.staleHours}h.`,
  large: "Mais de 1000 linhas alteradas.",
};

const SEVERITY_WEIGHT: Record<RiskSeverity, number> = { critical: 100, warning: 10, info: 1 };

export interface RiskInput {
  ageBand: AgeBand;
  reviewers: readonly unknown[];
  reviewState: ReviewState;
  updatedOn: string;
  approvedAt: number | null;
  changesCycles: number;
  build: BuildState | null;
  size: SizeBucket | null;
}

export function prRisks(pr: RiskInput, nowMs: number): RiskKind[] {
  const out = new Set<RiskKind>();
  if (pr.ageBand === "critical") out.add("sla_critical");
  else if (pr.ageBand === "warning") out.add("sla_warning");
  if (pr.build === "failed") out.add("build_failed");
  if (pr.reviewers.length === 0) out.add("no_reviewers");
  if (
    pr.reviewState === "approved" &&
    pr.approvedAt !== null &&
    nowMs - pr.approvedAt >= LEAD_LIMITS.approvedIdleHours * HOUR_MS
  ) {
    out.add("approved_not_merged");
  }
  if (pr.changesCycles >= LEAD_LIMITS.changesLoopCycles) out.add("changes_loop");
  if (nowMs - Date.parse(pr.updatedOn) >= LEAD_LIMITS.staleHours * HOUR_MS) out.add("stale");
  if (pr.size === "GG") out.add("large");
  return RISK_KINDS.filter((kind) => out.has(kind));
}

export function riskScore(risks: readonly RiskKind[]) {
  return risks.reduce((sum, kind) => sum + SEVERITY_WEIGHT[RISK_SEVERITY[kind]], 0);
}

export function worstSeverity(risks: readonly RiskKind[]): RiskSeverity | null {
  if (risks.some((k) => RISK_SEVERITY[k] === "critical")) return "critical";
  if (risks.some((k) => RISK_SEVERITY[k] === "warning")) return "warning";
  return risks.length > 0 ? "info" : null;
}

/** Tem algum sinal que pede ação (crítico ou atenção). */
export function isFlagged(risks: readonly RiskKind[]) {
  const worst = worstSeverity(risks);
  return worst === "critical" || worst === "warning";
}

/**
 * "Atenção agora": PRs com sinal crítico ou de atenção, fora os silenciados,
 * do mais grave para o menos e, no empate, do mais antigo.
 */
export function rankAttention<T extends { risks: RiskKind[]; createdOn: string; snoozed: boolean }>(
  prs: readonly T[],
  limit = 10,
): T[] {
  return prs
    .filter((pr) => !pr.snoozed && isFlagged(pr.risks))
    .toSorted(
      (a, b) =>
        riskScore(b.risks) - riskScore(a.risks) || Date.parse(a.createdOn) - Date.parse(b.createdOn),
    )
    .slice(0, limit);
}

// --- PR visto pelo líder -------------------------------------------------------

export interface LeadPullRequest {
  key: string;
  id: number;
  title: string;
  url: string;
  repository: PullRequest["repository"];
  author: PullRequest["author"];
  createdOn: string;
  updatedOn: string;
  reviewState: ReviewState;
  ageBand: AgeBand;
  approvals: number;
  minApprovals: number;
  reviewers: PullRequest["reviewers"];
  jiraKey: string | null;
  destinationBranch: string | null;
  snoozed: boolean;
  build: BuildState | null;
  size: SizeBucket | null;
  changesCycles: number;
  teamIds: number[];
  projectIds: number[];
  risks: RiskKind[];
  score: number;
}

// --- Saúde por time -----------------------------------------------------------

export type HealthStatus = "ok" | "attention" | "critical";

export const HEALTH_LABELS: Record<HealthStatus, string> = {
  ok: "Saudável",
  attention: "Atenção",
  critical: "Crítico",
};

/** PRs acima do SLA crítico a partir dos quais o time fica crítico. */
export const CRITICAL_TEAM_THRESHOLD = 2;

/**
 * Crítico com `CRITICAL_TEAM_THRESHOLD` ou mais PRs acima do SLA crítico;
 * atenção quando há qualquer PR crítico ou com sinal de atenção.
 */
export function healthStatus(counts: { open: number; critical: number; flagged: number }): HealthStatus {
  if (counts.open === 0) return "ok";
  if (counts.critical >= CRITICAL_TEAM_THRESHOLD) return "critical";
  if (counts.critical > 0 || counts.flagged > 0) return "attention";
  return "ok";
}

export interface RiskCounts {
  open: number;
  critical: number;
  warning: number;
  noReviewers: number;
  approvedIdle: number;
  stale: number;
  buildFailed: number;
  flagged: number;
}

export function countRisks(prs: readonly { risks: RiskKind[] }[]): RiskCounts {
  const counts: RiskCounts = {
    open: prs.length,
    critical: 0,
    warning: 0,
    noReviewers: 0,
    approvedIdle: 0,
    stale: 0,
    buildFailed: 0,
    flagged: 0,
  };
  for (const { risks } of prs) {
    if (risks.includes("sla_critical")) counts.critical++;
    if (risks.includes("sla_warning")) counts.warning++;
    if (risks.includes("no_reviewers")) counts.noReviewers++;
    if (risks.includes("approved_not_merged")) counts.approvedIdle++;
    if (risks.includes("stale")) counts.stale++;
    if (risks.includes("build_failed")) counts.buildFailed++;
    if (isFlagged(risks)) counts.flagged++;
  }
  return counts;
}

export interface DailyHealth {
  day: string;
  status: HealthStatus;
  open: number;
  critical: number;
}

export interface TeamHealth {
  id: number;
  name: string;
  memberUuids: string[];
  status: HealthStatus;
  counts: RiskCounts;
  stats: WindowStats;
  /** Uma entrada por dia da janela; o histórico só conhece o SLA. */
  daily: DailyHealth[];
  opened: number[];
  closed: number[];
}

const EMPTY_STATS: WindowStats = {
  opened: 0,
  closed: 0,
  firstReviewMedianHours: null,
  cycleMedianHours: null,
};

export function buildTeamHealth(
  team: { id: number; name: string; memberUuids: string[] },
  prs: readonly { risks: RiskKind[] }[],
  rows: HistoryRow[],
  buckets: DayBucket[],
  slaByRepo: Map<string, Sla>,
): TeamHealth {
  const counts = countRisks(prs);
  const queue = queueSeries(rows, buckets, slaByRepo);
  const throughput = throughputSeries(rows, buckets);
  const first = buckets[0];
  const last = buckets.at(-1);
  const status = healthStatus(counts);
  const daily = queue.map((p) => ({
    day: p.day,
    status: healthStatus({ open: p.total, critical: p.critical, flagged: p.warning + p.critical }),
    open: p.total,
    critical: p.critical,
  }));
  // Hoje vale o retrato ao vivo, que enxerga todos os sinais e não só o SLA.
  const today = daily.at(-1);
  if (today) Object.assign(today, { status, open: counts.open, critical: counts.critical });
  return {
    id: team.id,
    name: team.name,
    memberUuids: team.memberUuids,
    status,
    counts,
    stats: first && last ? windowStats(rows, first.startMs, last.cutoffMs) : EMPTY_STATS,
    daily,
    opened: throughput.map((p) => p.opened),
    closed: throughput.map((p) => p.closed),
  };
}

// --- Funil de entrega ---------------------------------------------------------

export interface DeliveryFunnel {
  opened: number;
  reviewed: number;
  approved: number;
  closed: number;
}

/** Dos PRs abertos na janela, quantos já tiveram revisão, aprovação e conclusão. */
export function deliveryFunnel(rows: readonly HistoryRow[], fromMs: number, toMs: number): DeliveryFunnel {
  const funnel: DeliveryFunnel = { opened: 0, reviewed: 0, approved: 0, closed: 0 };
  for (const row of rows) {
    const created = Date.parse(row.createdOn);
    if (created < fromMs || created > toMs) continue;
    funnel.opened++;
    const done = row.closedAt !== null && row.closedAt <= toMs;
    if (done || (row.firstReviewAt !== null && row.firstReviewAt <= toMs)) funnel.reviewed++;
    if (done || (row.approvedAt !== null && row.approvedAt <= toMs)) funnel.approved++;
    if (done) funnel.closed++;
  }
  return funnel;
}

// --- Andamento por projeto ----------------------------------------------------

export interface ProjectLinkInput {
  prKey: string;
  title: string;
  url: string;
  repoSlug: string;
  authorName: string | null;
  addedAt: number;
}

export interface ProjectPullRequest {
  prKey: string;
  title: string;
  url: string;
  repoSlug: string;
  authorName: string | null;
  stage: PullRequestStage | "untracked";
  risks: RiskKind[];
}

export type TimelineKind = "opened" | "reviewed" | "approved" | "closed";

export interface TimelineEvent {
  at: number;
  kind: TimelineKind;
  prKey: string;
  title: string;
}

export interface ProjectProgress extends FeatureSummary {
  /** Concluídos sobre os CRs com histórico; null sem nenhum. */
  progress: number | null;
  idle: boolean;
  /** CRs abertos do projeto com sinal crítico ou de atenção. */
  flagged: number;
  worst: RiskSeverity | null;
  pullRequests: ProjectPullRequest[];
  timeline: TimelineEvent[];
}

const TIMELINE_LIMIT = 12;

function projectTimeline(links: ProjectLinkInput[], rowsByKey: Map<string, HistoryRow>): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const link of links) {
    const row = rowsByKey.get(link.prKey);
    if (!row) continue;
    const push = (at: number | null, kind: TimelineKind) => {
      if (at !== null) events.push({ at, kind, prKey: link.prKey, title: link.title });
    };
    push(Date.parse(row.createdOn), "opened");
    push(row.firstReviewAt, "reviewed");
    push(row.approvedAt, "approved");
    push(row.closedAt, "closed");
  }
  return events.toSorted((a, b) => b.at - a.at).slice(0, TIMELINE_LIMIT);
}

export function buildProjectProgress(
  features: (Omit<FeatureInput, "links"> & { links: ProjectLinkInput[] })[],
  rows: HistoryRow[],
  risksByKey: Map<string, RiskKind[]>,
  buckets: DayBucket[],
  opts: { scoped: boolean; nowMs: number },
): ProjectProgress[] {
  const board = buildFeatureBoard(features, rows, buckets, opts);
  const byId = new Map(features.map((f) => [f.id, f]));
  const rowsByKey = new Map(rows.map((row) => [row.prKey, row]));
  const idleBefore = opts.nowMs - LEAD_LIMITS.projectIdleDays * DAY_MS;

  return board.features.map((summary) => {
    const feature = byId.get(summary.id)!;
    const links = feature.links.filter((l) => !opts.scoped || rowsByKey.has(l.prKey));
    const pullRequests: ProjectPullRequest[] = links.map((link) => {
      const row = rowsByKey.get(link.prKey);
      const stage = row ? stageAt(row, opts.nowMs) : "untracked";
      return {
        prKey: link.prKey,
        title: link.title,
        url: link.url,
        repoSlug: link.repoSlug,
        authorName: link.authorName,
        stage,
        risks: stage === "closed" ? [] : (risksByKey.get(link.prKey) ?? []),
      };
    });
    const tracked = summary.total - summary.stages.untracked;
    const open = summary.stages.waiting + summary.stages.inReview + summary.stages.approved;
    const allRisks = pullRequests.flatMap((pr) => pr.risks);
    const lastActivity = summary.lastActivityAt ?? summary.createdAt;
    return {
      ...summary,
      progress: tracked > 0 ? summary.stages.closed / tracked : null,
      idle: summary.status === "active" && open > 0 && lastActivity < idleBefore,
      flagged: pullRequests.filter((pr) => isFlagged(pr.risks)).length,
      worst: worstSeverity(allRisks),
      pullRequests: pullRequests.toSorted(
        (a, b) => riskScore(b.risks) - riskScore(a.risks) || a.title.localeCompare(b.title, "pt-BR"),
      ),
      timeline: projectTimeline(links, rowsByKey),
    };
  });
}

// --- Carga por pessoa ---------------------------------------------------------

export interface PersonLoad {
  uuid: string;
  displayName: string;
  avatarUrl: string | null;
  pending: number;
  overdue: number;
  authored: number;
  /** PRs da própria pessoa com sinal crítico ou de atenção. */
  authoredFlagged: number;
}

export function buildPeopleLoad(
  prs: readonly (Pick<LeadPullRequest, "author" | "reviewers" | "ageBand" | "risks">)[],
  members: readonly { uuid: string; displayName: string; avatarUrl: string | null }[],
): PersonLoad[] {
  const load = reviewLoadByMember([...prs]);
  const flagged = new Map<string, number>();
  for (const pr of prs) {
    if (isFlagged(pr.risks)) flagged.set(pr.author.uuid, (flagged.get(pr.author.uuid) ?? 0) + 1);
  }
  return members
    .map((m) => {
      const l = load.get(m.uuid) ?? { pending: 0, overdue: 0, authored: 0 };
      return { ...m, ...l, authoredFlagged: flagged.get(m.uuid) ?? 0 };
    })
    .toSorted(
      (a, b) =>
        b.overdue - a.overdue ||
        b.pending - a.pending ||
        b.authoredFlagged - a.authoredFlagged ||
        a.displayName.localeCompare(b.displayName, "pt-BR"),
    );
}
