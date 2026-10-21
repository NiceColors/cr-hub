import { createTtlCache } from "@/lib/cache";

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
}

export const pullRequestsCache =
  globalThis.__crTrackerPullRequestsCache ??
  createTtlCache<PullRequestsCacheValue<unknown>>();
globalThis.__crTrackerPullRequestsCache = pullRequestsCache;

export const lastForceAtByKey =
  globalThis.__crTrackerLastForceAtByKey ?? new Map<string, number>();
globalThis.__crTrackerLastForceAtByKey = lastForceAtByKey;

