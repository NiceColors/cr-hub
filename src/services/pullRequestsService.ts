import { BitbucketHttpError, mapLimit } from "@/lib/bitbucket/client";
import {
  DEFAULT_RETRY_AFTER_SECONDS,
  pickReposToRefresh,
  reposToRefreshThisPoll,
} from "@/lib/bitbucket/rateLimit";
import { PULL_REQUEST_READ_SCOPE } from "@/lib/bitbucket/scopes";
import { bitbucketClient } from "@/services/bitbucketClient";
import {
  canForceRefresh,
  getRateLimitRemainingSeconds,
  getRepoSnapshot,
  pullRequestsCache,
  setRateLimitUntilSecondsFromNow,
  setRepoSnapshot,
  singleFlight,
} from "@/lib/pullRequestsCache";
import { refreshCounter, requestsCounter } from "@/lib/requestsCounter";
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
import { listComplexities } from "@/services/complexityService";
import { recordHistory } from "@/services/historyService";

type CacheValue = {
  pullRequests: PullRequest[];
  errors: PullRequestListResult["errors"];
  fetchedAt: string;
};

type MonitoredRepo = ReturnType<typeof listMonitoredRepositories>[number];

function stripRateLimitErrors(errors: PullRequestListResult["errors"]) {
  return errors.filter((error) => error.status !== 429);
}

/** Aproveita a fila que já estava em cache para não zerar os repositórios que responderam. */
function seedSnapshots(scope: string, repos: MonitoredRepo[], cached: CacheValue | undefined) {
  if (!cached) return;
  const parsed = Date.parse(cached.fetchedAt);
  const fetchedAtMs = Number.isNaN(parsed) ? Date.now() : parsed;
  const grouped = new Map<string, PullRequest[]>();
  for (const pr of cached.pullRequests) {
    const list = grouped.get(pr.repository.uuid) ?? [];
    list.push(pr);
    grouped.set(pr.repository.uuid, list);
  }
  for (const [uuid, pullRequests] of grouped) {
    if (getRepoSnapshot(scope, uuid)) continue;
    setRepoSnapshot(scope, uuid, { pullRequests, fetchedAtMs });
  }
  for (const error of cached.errors) {
    if (error.status === 429) continue;
    const repo = repos.find((item) => item.slug === error.repositorySlug);
    if (!repo || getRepoSnapshot(scope, repo.uuid)?.error) continue;
    const existing = getRepoSnapshot(scope, repo.uuid);
    setRepoSnapshot(scope, repo.uuid, {
      pullRequests: existing?.pullRequests ?? [],
      fetchedAtMs: existing?.fetchedAtMs ?? fetchedAtMs,
      error,
    });
  }
}

function assembleList(scope: string, repos: { uuid: string }[], nowMs: number) {
  const pullRequests: PullRequest[] = [];
  const errors: PullRequestListResult["errors"] = [];
  for (const repo of repos) {
    const snap = getRepoSnapshot(scope, repo.uuid, nowMs);
    if (!snap) continue;
    for (const pr of snap.pullRequests) {
      const ageBand = computeAgeBand(pr.createdOn, nowMs, pr.sla);
      pullRequests.push(ageBand === pr.ageBand ? pr : { ...pr, ageBand });
    }
    if (snap.error) errors.push(snap.error);
  }
  return { pullRequests: sortByAge(pullRequests), errors };
}

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

function attachComplexities(prs: PullRequest[]): PullRequest[] {
  const complexities = listComplexities();
  return prs.map((pr) => {
    const complexity = complexities.get(prKey(pr.repository.uuid, pr.id)) ?? null;
    return pr.complexity === complexity ? pr : { ...pr, complexity };
  });
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
    const withSnoozes = {
      ...result,
      pullRequests: attachComplexities(attachSnoozes(result.pullRequests, Date.now())),
    };
    if (!opts.teamId) return withSnoozes;
    const team = getTeam(opts.teamId);
    if (!team) return { ...withSnoozes, pullRequests: [] };
    return {
      ...withSnoozes,
      pullRequests: filterByTeam(withSnoozes.pullRequests, team, repos),
    };
  }

  seedSnapshots(key, repos, cached?.value);

  function fromStore(
    fromCache: boolean,
    rateLimit?: { retryAfterSeconds: number },
  ): PullRequestListResult {
    const assembled = assembleList(key, repos, Date.now());
    const hasStore = assembled.pullRequests.length > 0 || assembled.errors.length > 0;
    const base = hasStore
      ? {
          pullRequests: assembled.pullRequests,
          errors: assembled.errors,
          fetchedAt: cached?.value.fetchedAt ?? emptyBase.fetchedAt,
        }
      : {
          ...(cached?.value ?? emptyBase),
          errors: stripRateLimitErrors(cached?.value.errors ?? []),
        };
    return finalize({
      ...base,
      fromCache,
      ...(rateLimit ? { rateLimit } : {}),
    });
  }

  if (rateRemaining > 0) {
    return fromStore(true, { retryAfterSeconds: rateRemaining });
  }

  const cachedHasRateErrors = cached?.value.errors.some((error) => error.status === 429) ?? false;

  if (!opts.force && cached && !cachedHasRateErrors) {
    return finalize({
      ...cached.value,
      errors: stripRateLimitErrors(cached.value.errors),
      fromCache: true,
    });
  }

  if (opts.force && cached) {
    const gate = canForceRefresh(key);
    if (!gate.allowed) {
      return finalize({
        ...cached.value,
        errors: stripRateLimitErrors(cached.value.errors),
        fromCache: true,
      });
    }
  }

  const budget = reposToRefreshThisPoll({
    pollIntervalSeconds: settings.pollIntervalSeconds,
    requestsLastHour: requestsCounter.countLastHour(),
    repoCount: repos.length,
    force: opts.force,
  });
  if (budget === 0) {
    return fromStore(true, {
      retryAfterSeconds: Math.max(rateRemaining, settings.pollIntervalSeconds),
    });
  }

  const memberUuids = new Set(members.map((m) => m.uuid));
  const jiraKeys = parseJiraProjectKeys(settings.jiraProjectKeys);

  const base = await singleFlight(key, async () => {
    const nowMs = Date.now();
    if (getRateLimitRemainingSeconds(nowMs) > 0) {
      const assembled = assembleList(key, repos, nowMs);
      return {
        pullRequests: assembled.pullRequests,
        errors: assembled.errors,
        fetchedAt: cached?.value.fetchedAt ?? new Date(nowMs).toISOString(),
      } satisfies CacheValue;
    }

    const authorUuids = members.map((m) => m.uuid);
    const fetchedAt = new Map<string, number>();
    for (const repo of repos) {
      const snap = getRepoSnapshot(key, repo.uuid, nowMs);
      if (snap) fetchedAt.set(repo.uuid, snap.fetchedAtMs);
    }
    const selected = pickReposToRefresh(repos, fetchedAt, budget);
    if (selected.length > 0) refreshCounter.add();
    const okRepoUuids: string[] = [];
    let halt = false;

    await mapLimit(selected, 2, async (repo) => {
      if (halt || getRateLimitRemainingSeconds() > 0) return;
      try {
        const prs = await bitbucketClient.listOpenPullRequests(
          repo.slug,
          authorUuids,
          me?.uuid ?? null,
        );
        okRepoUuids.push(repo.uuid);
        const sla = resolveSla(repo);
        const pullRequests: PullRequest[] = [];
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
            complexity: null,
          });
        }
        setRepoSnapshot(key, repo.uuid, { pullRequests, fetchedAtMs: nowMs });
      } catch (err) {
        if (err instanceof BitbucketHttpError && err.status === 429) {
          halt = true;
          setRateLimitUntilSecondsFromNow(err.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS);
          return;
        }
        const previous = getRepoSnapshot(key, repo.uuid, nowMs);
        if (err instanceof BitbucketHttpError) {
          const missingPullRequestScope = err.requiredScopes?.includes(PULL_REQUEST_READ_SCOPE);
          setRepoSnapshot(key, repo.uuid, {
            pullRequests: previous?.pullRequests ?? [],
            fetchedAtMs: nowMs,
            error: {
              repositorySlug: repo.slug,
              status: err.status,
              message: missingPullRequestScope
                ? "O token não tem o escopo para ler pull requests."
                : err.detail
                  ? `${err.message}: ${err.detail}`
                  : err.message,
              ...(err.requiredScopes?.length ? { requiredScopes: err.requiredScopes } : {}),
            },
          });
          return;
        }
        setRepoSnapshot(key, repo.uuid, {
          pullRequests: previous?.pullRequests ?? [],
          fetchedAtMs: nowMs,
          error: {
            repositorySlug: repo.slug,
            message: err instanceof Error ? err.message : "Erro desconhecido",
          },
        });
      }
    });

    const assembled = assembleList(key, repos, nowMs);
    try {
      recordHistory(assembled.pullRequests, okRepoUuids, nowMs);
    } catch (err) {
      console.warn("[history] falha ao gravar histórico:", err);
    }

    const value: CacheValue = {
      pullRequests: assembled.pullRequests,
      errors: assembled.errors,
      fetchedAt: new Date().toISOString(),
    };
    pullRequestsCache.set(key, { cachedAtMs: Date.now(), value }, ttlMs);
    return value;
  });

  return finalize({
    ...base,
    errors: stripRateLimitErrors(base.errors),
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
