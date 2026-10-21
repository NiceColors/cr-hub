import { describe, expect, test } from "vitest";
import {
  canForceRefresh,
  clearPullRequestsCache,
  getRateLimitRemainingSeconds,
  setRateLimitUntilSecondsFromNow,
  singleFlight,
} from "@/lib/pullRequestsCache";

describe("pullRequestsCache helpers", () => {
  test("canForceRefresh limita 1x/10s por chave", () => {
    clearPullRequestsCache();
    const key = "k1";
    const t0 = 1000;
    const ok1 = canForceRefresh(key, { nowMs: t0, minGapMs: 10_000 });
    expect(ok1.allowed).toBe(true);
    const ok2 = canForceRefresh(key, { nowMs: t0 + 9999, minGapMs: 10_000 });
    expect(ok2.allowed).toBe(false);
    const ok3 = canForceRefresh(key, { nowMs: t0 + 10_000, minGapMs: 10_000 });
    expect(ok3.allowed).toBe(true);
  });

  test("singleFlight deduplica chamadas concorrentes", async () => {
    clearPullRequestsCache();
    let calls = 0;
    const p1 = singleFlight("k", async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return 123;
    });
    const p2 = singleFlight("k", async () => 999);
    expect(await Promise.all([p1, p2])).toEqual([123, 123]);
    expect(calls).toBe(1);
  });

  test("rate limit restante zera após expirar", () => {
    const now = 1000;
    setRateLimitUntilSecondsFromNow(5, now);
    expect(getRateLimitRemainingSeconds(now)).toBe(5);
    expect(getRateLimitRemainingSeconds(now + 4999)).toBe(1);
    expect(getRateLimitRemainingSeconds(now + 5000)).toBe(0);
  });
});

