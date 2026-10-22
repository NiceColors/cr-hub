import { BitbucketHttpError } from "@/lib/bitbucket/client";
import { bitbucketClient } from "@/services/bitbucketClient";
import {
  canForceRefresh,
  getRateLimitRemainingSeconds,
  pullRequestsCache,
  setRateLimitUntilSecondsFromNow,
  singleFlight,
} from "@/lib/pullRequestsCache";
import { mapLimit } from "@/lib/bitbucket/client";
import {
  buildReviewers,
  classifyTargetBranch,
  computeAgeBand,
  computeReviewState,
  extractJiraKey,
  filterByTeam,
  parseJiraProjectKeys,
  prKey,
  resolveSla,
  sortByAge,
  type PullRequest,
  type PullRequestListResult,
} from "@/domain/pull-request";
import {
  getSettings,
  getTeam,
  listMonitoredMembers,
  listMonitoredRepositories,
} from "@/services/configService";
import { tryGetMe } from "@/services/meService";
import { deleteSnoozes, listSnoozes } from "@/services/snoozeService";
import { recordHistory } from "@/services/historyService";

type CacheValue = {
  pullRequests: PullRequest[];
  errors: PullRequestListResult["errors"];
  fetchedAt: string;
};

function cacheKey(
  repos: { uuid: string }[],
  members: { uuid: string }[],
  meUuid: string | null,
) {
  const r = [...repos.map((x) => x.uuid)].sort().join(",");
  const m = [...members.map((x) => x.uuid)].sort().join(",");
  return `prs:repos=${r};members=${m};me=${meUuid ?? ""}`;
}

/** Junta os snoozes vigentes à fila. Roda depois do cache, então silenciar não gera chamadas ao Bitbucket. */
function attachSnoozes(prs: PullRequest[], nowMs: number): PullRequest[] {
  const snoozes = listSnoozes(nowMs);
  if (snoozes.size === 0) return prs.map((pr) => (pr.snooze ? { ...pr, snooze: null } : pr));
  const stale: string[] = [];
  const out = prs.map((pr) => {
    const key = prKey(pr.repository.uuid, pr.id);
    const snooze = snoozes.get(key) ?? null;
    if (snooze?.kind === "until_change" && snooze.untilUpdatedOn !== pr.updatedOn) {
      stale.push(key);
      return { ...pr, snooze: null };
    }
    return { ...pr, snooze };
  });
  deleteSnoozes(stale);
  return out;
}

export async function listPullRequests(opts: {
  teamId?: number | null;
  force?: boolean;
}): Promise<PullRequestListResult> {
  const settings = getSettings();
  const ttlMs = settings.pollIntervalSeconds * 1000;

  const repos = listMonitoredRepositories();
  const members = listMonitoredMembers();
  const me = repos.length > 0 ? await tryGetMe() : null;

  const emptyBase: CacheValue = {
    pullRequests: [],
    errors: [],
    fetchedAt: new Date().toISOString(),
  };

  if (repos.length === 0 || (members.length === 0 && !me)) {
    return { ...emptyBase, fromCache: true };
  }

  const key = cacheKey(repos, members, me?.uuid ?? null);
  const rateRemaining = getRateLimitRemainingSeconds();
  const cached = pullRequestsCache.get(key) as
    | { cachedAtMs: number; value: CacheValue }
    | undefined;

  function finalize(result: PullRequestListResult): PullRequestListResult {
    const withSnoozes = { ...result, pullRequests: attachSnoozes(result.pullRequests, Date.now()) };
    if (!opts.teamId) return withSnoozes;
    const team = getTeam(opts.teamId);
    if (!team) return { ...withSnoozes, pullRequests: [] };
    return {
      ...withSnoozes,
      pullRequests: filterByTeam(withSnoozes.pullRequests, team, repos),
    };
  }

  if (rateRemaining > 0) {
    return finalize({
      ...(cached?.value ?? emptyBase),
      fromCache: true,
      rateLimit: { retryAfterSeconds: rateRemaining },
    });
  }

  if (!opts.force && cached) {
    return finalize({ ...cached.value, fromCache: true });
  }

  if (opts.force && cached) {
    const gate = canForceRefresh(key);
    if (!gate.allowed) {
      return finalize({ ...cached.value, fromCache: true });
    }
  }

  const memberUuids = new Set(members.map((m) => m.uuid));
  const jiraKeys = parseJiraProjectKeys(settings.jiraProjectKeys);

  const base = await singleFlight(key, async () => {
    const nowMs = Date.now();
    const authorUuids = members.map((m) => m.uuid);

    const errors: PullRequestListResult["errors"] = [];
    const pullRequests: PullRequest[] = [];
    const okRepoUuids: string[] = [];
    let minRetryAfter: number | undefined = undefined;

    await mapLimit(repos, 4, async (repo) => {
      try {
        const prs = await bitbucketClient.listOpenPullRequests(
          repo.slug,
          authorUuids,
          me?.uuid ?? null,
        );
        okRepoUuids.push(repo.uuid);
        const sla = resolveSla(repo);
        for (const pr of prs) {
          const participants = (pr.participants ?? []).map((p) => ({
            userUuid: p.user.uuid,
            approved: p.approved ?? null,
            state: p.state ?? null,
          }));

          const review = computeReviewState(participants, pr.author.uuid, repo.minApprovals);
          const sourceBranch = pr.source?.branch?.name ?? null;
          const destinationBranch = pr.destination?.branch?.name ?? null;

          pullRequests.push({
            id: pr.id,
            title: pr.title,
            url: pr.links.html.href,
            repository: { uuid: repo.uuid, slug: repo.slug, name: repo.name },
            author: {
              uuid: pr.author.uuid,
              displayName:
                pr.author.display_name ?? pr.author.nickname ?? pr.author.uuid,
              avatarUrl: pr.author.links?.avatar?.href ?? null,
            },
            createdOn: pr.created_on,
            updatedOn: pr.updated_on ?? pr.created_on,
            approvals: review.approvals,
            minApprovals: repo.minApprovals,
            changesRequested: review.changesRequested,
            hasReviewActivity: review.hasReviewActivity,
            reviewState: review.reviewState,
            ageBand: computeAgeBand(pr.created_on, nowMs, sla),
            sla,
            reviewers: buildReviewers(
              (pr.reviewers ?? []).map((r) => ({
                uuid: r.uuid,
                displayName: r.display_name ?? r.nickname ?? r.uuid,
                avatarUrl: r.links?.avatar?.href ?? null,
              })),
              participants,
            ),
            commentCount: pr.comment_count ?? 0,
            taskCount: pr.task_count ?? 0,
            sourceBranch,
            destinationBranch,
            targetKind: classifyTargetBranch(destinationBranch),
            jiraKey: extractJiraKey(pr.title, sourceBranch, jiraKeys),
            authorMonitored: memberUuids.has(pr.author.uuid),
            snooze: null,
          });
        }
      } catch (err) {
        if (err instanceof BitbucketHttpError) {
          if (err.status === 429 && typeof err.retryAfterSeconds === "number") {
            minRetryAfter =
              typeof minRetryAfter === "number"
                ? Math.min(minRetryAfter, err.retryAfterSeconds)
                : err.retryAfterSeconds;
          }
          errors.push({
            repositorySlug: repo.slug,
            status: err.status,
            message: err.message,
          });
          return;
        }
        errors.push({
          repositorySlug: repo.slug,
          message: err instanceof Error ? err.message : "Erro desconhecido",
        });
      }
    });

    if (typeof minRetryAfter === "number" && minRetryAfter > 0) {
      setRateLimitUntilSecondsFromNow(minRetryAfter);
    }

    const sorted = sortByAge(pullRequests);
    try {
      recordHistory(sorted, okRepoUuids, nowMs);
    } catch (err) {
      console.warn("[history] falha ao gravar histórico:", err);
    }

    const value: CacheValue = {
      pullRequests: sorted,
      errors,
      fetchedAt: new Date().toISOString(),
    };
    pullRequestsCache.set(key, { cachedAtMs: Date.now(), value }, ttlMs);
    return value;
  });

  return finalize({
    ...base,
    fromCache: false,
    rateLimit:
      getRateLimitRemainingSeconds() > 0
        ? { retryAfterSeconds: getRateLimitRemainingSeconds() }
        : undefined,
  });
}

/** PR da fila em cache (sem time), usado pelas rotas de detalhe e ações. */
export async function findCachedPullRequest(repoUuid: string, id: number) {
  const result = await listPullRequests({});
  return result.pullRequests.find((pr) => pr.repository.uuid === repoUuid && pr.id === id) ?? null;
}
