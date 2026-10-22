export type ReviewState =
  | "waiting"
  | "in_review"
  | "changes_requested"
  | "approved";

export type AgeBand = "normal" | "warning" | "critical";

export type TargetKind = "production" | "release" | "hotfix";

export type SnoozeKind = "24h" | "tomorrow" | "until_change";

export type BuildState = "successful" | "failed" | "in_progress" | "none";

export type SizeBucket = "P" | "M" | "G" | "GG";

export interface Sla {
  warningHours: number;
  criticalHours: number;
}

export const DEFAULT_SLA: Sla = { warningHours: 24, criticalHours: 72 };

export interface Reviewer {
  uuid: string;
  displayName: string;
  avatarUrl?: string | null;
  approved: boolean;
  changesRequested: boolean;
}

export interface Snooze {
  reason: string;
  kind: SnoozeKind;
  untilMs: number | null;
  untilUpdatedOn: string | null;
  createdAt: string; // ISO
}

export interface PullRequest {
  id: number;
  title: string;
  url: string;
  repository: { uuid: string; slug: string; name: string };
  author: { uuid: string; displayName: string; avatarUrl?: string | null };
  createdOn: string; // ISO
  updatedOn: string; // ISO
  approvals: number;
  minApprovals: number;
  changesRequested: boolean;
  hasReviewActivity: boolean;
  reviewState: ReviewState;
  ageBand: AgeBand;
  sla: Sla;
  reviewers: Reviewer[];
  commentCount: number;
  taskCount: number;
  sourceBranch: string | null;
  destinationBranch: string | null;
  targetKind: TargetKind | null;
  jiraKey: string | null;
  authorMonitored: boolean;
  snooze: Snooze | null;
}

export interface RepoFetchError {
  repositorySlug: string;
  status?: number;
  message: string;
}

export interface PullRequestListResult {
  pullRequests: PullRequest[];
  errors: RepoFetchError[];
  fetchedAt: string; // ISO
  fromCache: boolean;
  rateLimit?: { retryAfterSeconds: number };
}

export type BbParticipant = {
  userUuid: string;
  approved?: boolean | null;
  state?: string | null;
};

const HOUR_MS = 60 * 60 * 1000;

export function prKey(repoUuid: string, id: number) {
  return `${repoUuid}:${id}`;
}

export function resolveSla(repo: {
  slaWarningHours?: number | null;
  slaCriticalHours?: number | null;
}): Sla {
  return {
    warningHours: repo.slaWarningHours ?? DEFAULT_SLA.warningHours,
    criticalHours: repo.slaCriticalHours ?? DEFAULT_SLA.criticalHours,
  };
}

export function computeAgeBand(
  createdOnIso: string,
  nowMs: number,
  sla: Sla = DEFAULT_SLA,
): AgeBand {
  const createdMs = Date.parse(createdOnIso);
  const age = Math.max(0, nowMs - createdMs);
  if (age > sla.criticalHours * HOUR_MS) return "critical";
  if (age >= sla.warningHours * HOUR_MS) return "warning";
  return "normal";
}

export function countApprovals(
  participants: BbParticipant[],
  authorUuid: string,
) {
  return participants.filter(
    (p) => p.approved === true && p.userUuid !== authorUuid,
  ).length;
}

function isChangesRequestedState(state: string | null | undefined) {
  const s = (state ?? "").toLowerCase();
  return s === "changes_requested" || s === "changes-requested";
}

export function hasChangesRequested(participants: BbParticipant[]) {
  return participants.some((p) => isChangesRequestedState(p.state));
}

export function computeReviewState(
  participants: BbParticipant[],
  authorUuid: string,
  minApprovals: number,
): { approvals: number; changesRequested: boolean; hasReviewActivity: boolean; reviewState: ReviewState } {
  const approvals = countApprovals(participants, authorUuid);
  const changesRequested = hasChangesRequested(participants);

  const hasReviewActivity = participants.some((p) => {
    if (p.userUuid === authorUuid) return false;
    if (p.approved === true) return true;
    return (p.state ?? null) !== null;
  });

  const reviewState: ReviewState = changesRequested
    ? "changes_requested"
    : approvals >= minApprovals
      ? "approved"
      : hasReviewActivity
        ? "in_review"
        : "waiting";

  return { approvals, changesRequested, hasReviewActivity, reviewState };
}

export function buildReviewers(
  reviewers: { uuid: string; displayName: string; avatarUrl?: string | null }[],
  participants: BbParticipant[],
): Reviewer[] {
  const byUuid = new Map(participants.map((p) => [p.userUuid, p]));
  return reviewers.map((r) => {
    const p = byUuid.get(r.uuid);
    return {
      ...r,
      approved: p?.approved === true,
      changesRequested: isChangesRequestedState(p?.state),
    };
  });
}

export function classifyTargetBranch(name: string | null | undefined): TargetKind | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n === "master" || n === "main") return "production";
  if (n.startsWith("release/") || n === "release") return "release";
  if (n.startsWith("hotfix/") || n === "hotfix") return "hotfix";
  return null;
}

const TARGET_PRIORITY: Record<TargetKind, number> = {
  hotfix: 0,
  production: 1,
  release: 2,
};

/** Menor valor = mais prioritário. PRs sem destino especial ficam por último. */
export function targetPriority(kind: TargetKind | null) {
  return kind ? TARGET_PRIORITY[kind] : 3;
}

const JIRA_KEY_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/g;

export function parseJiraProjectKeys(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((k) => k.trim().toUpperCase())
    .filter(Boolean);
}

export function extractJiraKey(
  title: string,
  branch: string | null | undefined,
  allowedKeys: string[] = [],
): string | null {
  const allowed = new Set(allowedKeys.map((k) => k.toUpperCase()));
  for (const source of [title, branch?.toUpperCase() ?? ""]) {
    for (const match of source.matchAll(JIRA_KEY_RE)) {
      const key = match[1]!;
      const project = key.slice(0, key.lastIndexOf("-"));
      if (allowed.size === 0 || allowed.has(project)) return key;
    }
  }
  return null;
}

export function isSnoozeActive(
  snooze: Snooze | null | undefined,
  updatedOn: string,
  nowMs: number,
) {
  if (!snooze) return false;
  if (snooze.kind === "until_change") return snooze.untilUpdatedOn === updatedOn;
  return snooze.untilMs !== null && snooze.untilMs > nowMs;
}

/** "Até amanhã" vence às 09:00 do dia seguinte, no fuso local do processo. */
export function computeSnoozeUntilMs(kind: SnoozeKind, nowMs: number): number | null {
  if (kind === "24h") return nowMs + 24 * HOUR_MS;
  if (kind === "tomorrow") {
    const d = new Date(nowMs);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  }
  return null;
}

type ReviewerView = Pick<PullRequest, "author" | "reviewers">;

function isPendingFor(pr: ReviewerView, uuid: string) {
  if (pr.author.uuid === uuid) return false;
  const reviewer = pr.reviewers.find((r) => r.uuid === uuid);
  return Boolean(reviewer && !reviewer.approved && !reviewer.changesRequested);
}

export function isAwaitingReviewBy(
  pr: ReviewerView & Pick<PullRequest, "snooze" | "updatedOn">,
  meUuid: string | null | undefined,
  nowMs: number,
) {
  if (!meUuid) return false;
  if (isSnoozeActive(pr.snooze, pr.updatedOn, nowMs)) return false;
  return isPendingFor(pr, meUuid);
}

export function isReviewerOrAuthor(pr: ReviewerView, uuid: string | null | undefined) {
  if (!uuid) return false;
  return pr.author.uuid === uuid || pr.reviewers.some((r) => r.uuid === uuid);
}

export type ReviewLoad = { pending: number; overdue: number; authored: number };

export function reviewLoadByMember(
  prs: (ReviewerView & Pick<PullRequest, "ageBand">)[],
): Map<string, ReviewLoad> {
  const out = new Map<string, ReviewLoad>();
  const get = (uuid: string) => {
    let load = out.get(uuid);
    if (!load) {
      load = { pending: 0, overdue: 0, authored: 0 };
      out.set(uuid, load);
    }
    return load;
  };
  for (const pr of prs) {
    get(pr.author.uuid).authored++;
    for (const r of pr.reviewers) {
      if (!isPendingFor(pr, r.uuid)) continue;
      const load = get(r.uuid);
      load.pending++;
      if (pr.ageBand !== "normal") load.overdue++;
    }
  }
  return out;
}

/** Membros (entre os candidatos) com a menor carga pendente. */
export function leastLoadedMembers(candidates: string[], load: Map<string, ReviewLoad>) {
  if (candidates.length === 0) return [];
  const pendingOf = (uuid: string) => load.get(uuid)?.pending ?? 0;
  const min = Math.min(...candidates.map(pendingOf));
  return candidates.filter((uuid) => pendingOf(uuid) === min);
}

export function sizeBucket(totalLines: number): SizeBucket {
  if (totalLines <= 50) return "P";
  if (totalLines <= 250) return "M";
  if (totalLines <= 1000) return "G";
  return "GG";
}

export function aggregateBuildState(states: string[]): BuildState {
  if (states.length === 0) return "none";
  const upper = states.map((s) => s.toUpperCase());
  if (upper.some((s) => s === "FAILED" || s === "STOPPED")) return "failed";
  if (upper.some((s) => s === "INPROGRESS")) return "in_progress";
  return "successful";
}

export function isReadyToMerge(
  pr: Pick<PullRequest, "reviewState" | "taskCount">,
  build: BuildState | null | undefined,
) {
  if (pr.reviewState !== "approved") return false;
  if (pr.taskCount > 0) return false;
  return build !== "failed" && build !== "in_progress";
}

export function resolveTeamScope(
  team: { repositoryUuids: string[] } | null,
  monitoredRepos: { uuid: string }[],
) {
  if (!team) return monitoredRepos.map((r) => r.uuid);
  if (team.repositoryUuids.length === 0) return monitoredRepos.map((r) => r.uuid);
  const set = new Set(team.repositoryUuids);
  return monitoredRepos.map((r) => r.uuid).filter((uuid) => set.has(uuid));
}

export function filterByTeam<
  T extends { author: { uuid: string }; repository: { uuid: string } },
>(
  prs: T[],
  team: { memberUuids: string[]; repositoryUuids: string[] } | null,
  monitoredRepos: { uuid: string }[],
) {
  if (!team) return prs;
  const members = new Set(team.memberUuids);
  const scopeRepoUuids = new Set(resolveTeamScope(team, monitoredRepos));
  return prs.filter(
    (pr) => members.has(pr.author.uuid) && scopeRepoUuids.has(pr.repository.uuid),
  );
}

export function sortByAge<T extends { createdOn: string }>(prs: T[]) {
  return [...prs].sort(
    (a, b) => Date.parse(a.createdOn) - Date.parse(b.createdOn),
  );
}
