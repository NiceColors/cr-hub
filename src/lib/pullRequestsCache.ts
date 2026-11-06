import type { PullRequest, RepoFetchError } from "@/domain/pull-request";
import { clearBitbucketRateLimit } from "@/lib/bitbucket/rateLimit";
import { createTtlCache } from "@/lib/cache";

export {
  clearBitbucketRateLimit,
  getRateLimitRemainingSeconds,
  setRateLimitUntilSecondsFromNow,
} from "@/lib/bitbucket/rateLimit";

export type PullRequestsCacheValue<T> = {
  cachedAtMs: number;
  value: T;
};

declare global {
  // eslint-disable-next-line no-var
  var __crTrackerPullRequestsCache:
    | ReturnType<typeof createTtlCache<PullRequestsCacheValue<unknown>>>
    | undefined;
  // eslint-disable-next-line no-var
  var __crTrackerLastForceAtByKey: Map<string, number> | undefined;
  // eslint-disable-next-line no-var
  var __crTrackerInFlightByKey: Map<string, Promise<unknown>> | undefined;
  // eslint-disable-next-line no-var
  var __crTrackerRepoSnapshots: Map<string, RepoSnapshot> | undefined;
}

const REPO_SNAPSHOT_TTL_MS = 20 * 60 * 1000;

export type RepoSnapshot = {
  pullRequests: PullRequest[];
  fetchedAtMs: number;
  error?: RepoFetchError;
};

const repoSnapshots =
  globalThis.__crTrackerRepoSnapshots ?? new Map<string, RepoSnapshot>();
globalThis.__crTrackerRepoSnapshots = repoSnapshots;

function snapshotKey(scope: string, repoUuid: string) {
  return `${scope}\0${repoUuid}`;
}

export function getRepoSnapshot(scope: string, repoUuid: string, nowMs = Date.now()) {
  const key = snapshotKey(scope, repoUuid);
  const entry = repoSnapshots.get(key);
  if (!entry) return undefined;
  if (nowMs - entry.fetchedAtMs > REPO_SNAPSHOT_TTL_MS) {
    repoSnapshots.delete(key);
    return undefined;
  }
  return entry;
}

export function setRepoSnapshot(scope: string, repoUuid: string, snapshot: RepoSnapshot) {
  repoSnapshots.set(snapshotKey(scope, repoUuid), snapshot);
}

export const pullRequestsCache =
  globalThis.__crTrackerPullRequestsCache ??
  createTtlCache<PullRequestsCacheValue<unknown>>();
globalThis.__crTrackerPullRequestsCache = pullRequestsCache;

export const lastForceAtByKey =
  globalThis.__crTrackerLastForceAtByKey ?? new Map<string, number>();
globalThis.__crTrackerLastForceAtByKey = lastForceAtByKey;

export const inFlightByKey =
  globalThis.__crTrackerInFlightByKey ?? new Map<string, Promise<unknown>>();
globalThis.__crTrackerInFlightByKey = inFlightByKey;

export function clearPullRequestsCache() {
  pullRequestsCache.clear();
  inFlightByKey.clear();
  lastForceAtByKey.clear();
  repoSnapshots.clear();
  clearBitbucketRateLimit();
}

export function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlightByKey.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => {
    inFlightByKey.delete(key);
  });
  inFlightByKey.set(key, p as Promise<unknown>);
  return p;
}

export function canForceRefresh(
  key: string,
  opts: { nowMs?: number; minGapMs?: number } = {},
) {
  const nowMs = opts.nowMs ?? Date.now();
  const minGapMs = opts.minGapMs ?? 10_000;
  const last = lastForceAtByKey.get(key);
  if (last === undefined) {
    lastForceAtByKey.set(key, nowMs);
    return { allowed: true as const, remainingMs: 0 };
  }

  const delta = nowMs - last;
  if (delta >= minGapMs) {
    lastForceAtByKey.set(key, nowMs);
    return { allowed: true as const, remainingMs: 0 };
  }
  return { allowed: false as const, remainingMs: minGapMs - delta };
}

