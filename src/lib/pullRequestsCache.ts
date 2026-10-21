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
  // eslint-disable-next-line no-var
  var __crTrackerInFlightByKey: Map<string, Promise<unknown>> | undefined;
  // eslint-disable-next-line no-var
  var __crTrackerRateLimitUntilMs: number | undefined;
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
  globalThis.__crTrackerRateLimitUntilMs = undefined;
}

export function getRateLimitRemainingSeconds(nowMs = Date.now()) {
  const until = globalThis.__crTrackerRateLimitUntilMs;
  if (!until) return 0;
  return Math.max(0, Math.ceil((until - nowMs) / 1000));
}

export function setRateLimitUntilSecondsFromNow(seconds: number, nowMs = Date.now()) {
  globalThis.__crTrackerRateLimitUntilMs = nowMs + seconds * 1000;
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

