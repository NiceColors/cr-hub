export type PullRequestAuthor = {
  uuid: string;
  nickname?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
};

export type PullRequestParticipant = {
  approved?: boolean | null;
  state?: string | null;
};

export type PullRequestItem = {
  id: number;
  title: string;
  url: string;
  repoSlug: string;
  repoName: string;
  author: PullRequestAuthor;
  createdOn: string;
  participants: PullRequestParticipant[];
};

export function summarizeReviewState(participants: PullRequestParticipant[]) {
  const approvals = participants.filter((p) => p.approved === true).length;
  const changesRequested = participants.some((p) => {
    const s = (p.state ?? "").toLowerCase();
    return s === "changes_requested" || s === "changes-requested";
  });
  return { approvals, changesRequested };
}

export function ageMs(createdOnIso: string, nowMs: number) {
  const created = Date.parse(createdOnIso);
  return Math.max(0, nowMs - created);
}

export function formatAgePtBR(ms: number) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `há ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min}min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dias`;
}

export function sortOldestFirst(prs: PullRequestItem[]) {
  return [...prs].sort((a, b) => Date.parse(a.createdOn) - Date.parse(b.createdOn));
}

export type Squad = {
  id: number;
  name: string;
  memberUuids: string[];
  repoFilterSlugs: string[]; // vazio => todos repos monitorados
};

export function filterPullRequestsBySquad(
  prs: PullRequestItem[],
  squad: Squad | null,
) {
  if (!squad) return prs;
  const memberSet = new Set(squad.memberUuids);
  const repoSet =
    squad.repoFilterSlugs.length > 0 ? new Set(squad.repoFilterSlugs) : null;

  return prs.filter((pr) => {
    if (!memberSet.has(pr.author.uuid)) return false;
    if (repoSet && !repoSet.has(pr.repoSlug)) return false;
    return true;
  });
}

