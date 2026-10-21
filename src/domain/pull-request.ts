export type ReviewState =
  | "waiting"
  | "in_review"
  | "changes_requested"
  | "approved";

export type AgeBand = "normal" | "warning" | "critical";

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

export function computeAgeBand(createdOnIso: string, nowMs: number): AgeBand {
  const createdMs = Date.parse(createdOnIso);
  const age = Math.max(0, nowMs - createdMs);
  const h24 = 24 * 60 * 60 * 1000;
  const h72 = 72 * 60 * 60 * 1000;
  if (age > h72) return "critical";
  if (age >= h24) return "warning";
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

export function hasChangesRequested(participants: BbParticipant[]) {
  return participants.some((p) => {
    const s = (p.state ?? "").toLowerCase();
    return s === "changes_requested" || s === "changes-requested";
  });
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

export function resolveTeamScope(
  team: { repositoryUuids: string[] } | null,
  monitoredRepos: { uuid: string }[],
) {
  if (!team) return monitoredRepos.map((r) => r.uuid);
  if (team.repositoryUuids.length === 0) return monitoredRepos.map((r) => r.uuid);
  const set = new Set(team.repositoryUuids);
  return monitoredRepos.map((r) => r.uuid).filter((uuid) => set.has(uuid));
}

export function filterByTeam(
  prs: PullRequest[],
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

export function sortByAge(prs: PullRequest[]) {
  return [...prs].sort(
    (a, b) => Date.parse(a.createdOn) - Date.parse(b.createdOn),
  );
}

