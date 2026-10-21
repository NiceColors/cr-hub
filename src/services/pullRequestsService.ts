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
  computeAgeBand,
  computeReviewState,
  filterByTeam,
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

type CacheValue = {
  pullRequests: PullRequest[];
  errors: PullRequestListResult["errors"];
  fetchedAt: string;
};

function cacheKey(repos: { uuid: string }[], members: { uuid: string }[]) {
  const r = [...repos.map((x) => x.uuid)].sort().join(",");
  const m = [...members.map((x) => x.uuid)].sort().join(",");
  return `prs:repos=${r};members=${m}`;
}

export async function listPullRequests(opts: {
  teamId?: number | null;
  force?: boolean;
}): Promise<PullRequestListResult> {
  const settings = getSettings();
  const ttlMs = settings.pollIntervalSeconds * 1000;

  const repos = listMonitoredRepositories();
  const members = listMonitoredMembers();

  const emptyBase: CacheValue = {
    pullRequests: [],
    errors: [],
    fetchedAt: new Date().toISOString(),
  };

  if (repos.length === 0 || members.length === 0) {
    const base: PullRequestListResult = {
      ...emptyBase,
      fromCache: true,
      pullRequests: [],
    };
    if (opts.teamId) {
      const team = getTeam(opts.teamId);
      base.pullRequests = team
        ? filterByTeam(base.pullRequests, team, repos)
        : [];
    }
    return base;
  }

  const key = cacheKey(repos, members);
  const rateRemaining = getRateLimitRemainingSeconds();
  const cached = pullRequestsCache.get(key) as
    | { cachedAtMs: number; value: CacheValue }
    | undefined;

  function applyTeamFilter(result: PullRequestListResult) {
    if (!opts.teamId) return result;
    const team = getTeam(opts.teamId);
    if (!team) return { ...result, pullRequests: [] };
    return {
      ...result,
      pullRequests: filterByTeam(result.pullRequests, team, repos),
    };
  }

  if (rateRemaining > 0) {
    if (cached) {
      return applyTeamFilter({
        ...(cached.value as CacheValue),
        fromCache: true,
        rateLimit: { retryAfterSeconds: rateRemaining },
      });
    }
    return applyTeamFilter({
      ...emptyBase,
      fromCache: true,
      rateLimit: { retryAfterSeconds: rateRemaining },
    });
  }

  if (!opts.force && cached) {
    return applyTeamFilter({
      ...(cached.value as CacheValue),
      fromCache: true,
    });
  }

  if (opts.force && cached) {
    const gate = canForceRefresh(key);
    if (!gate.allowed) {
      return applyTeamFilter({
        ...(cached.value as CacheValue),
        fromCache: true,
      });
    }
  }

  const base = await singleFlight(key, async () => {
    const nowMs = Date.now();
    const authorUuids = members.map((m) => m.uuid);

    const errors: PullRequestListResult["errors"] = [];
    const pullRequests: PullRequest[] = [];
    let minRetryAfter: number | undefined = undefined;

    await mapLimit(repos, 4, async (repo) => {
      try {
        const prs = await bitbucketClient.listOpenPullRequests(repo.slug, authorUuids);
        for (const pr of prs) {
          const participants = (pr.participants ?? []).map((p) => ({
            userUuid: p.user.uuid,
            approved: p.approved ?? null,
            state: p.state ?? null,
          }));

          const review = computeReviewState(participants, pr.author.uuid, repo.minApprovals);

          const mapped: PullRequest = {
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
            ageBand: computeAgeBand(pr.created_on, nowMs),
          };
          pullRequests.push(mapped);
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
    const value: CacheValue = {
      pullRequests: sorted,
      errors,
      fetchedAt: new Date().toISOString(),
    };
    pullRequestsCache.set(key, { cachedAtMs: Date.now(), value }, ttlMs);
    return value;
  });

  return applyTeamFilter({
    ...base,
    fromCache: false,
    rateLimit:
      getRateLimitRemainingSeconds() > 0
        ? { retryAfterSeconds: getRateLimitRemainingSeconds() }
        : undefined,
  });
}

