"use client";

import { useMemo } from "react";
import { isAwaitingReviewBy, isSnoozeActive } from "@/domain/pull-request";
import { DEFAULT_POLL_INTERVAL_SECONDS } from "@/lib/api/config";
import { useSettings } from "@/hooks/use-config";
import { useMe, usePullRequests } from "@/hooks/use-pull-requests";

/**
 * Fila global (sem time) com o dono do token e quantos PRs esperam a revisão
 * dele. Só consulta com a aba visível; se o intervalo passar em segundo plano,
 * dispara uma vez quando a pessoa volta.
 */
export function useAwaitingReview() {
  const settings = useSettings();
  const me = useMe();
  const { query } = usePullRequests({
    teamId: null,
    refreshIntervalSec: settings.data?.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS,
  });

  const meUuid = me.data?.uuid ?? null;
  const data = query.data;
  const count = useMemo(() => {
    if (!data || !meUuid) return 0;
    const nowMs = Date.parse(data.fetchedAt);
    return data.pullRequests.filter((pr) => isAwaitingReviewBy(pr, meUuid, nowMs)).length;
  }, [data, meUuid]);

  const criticalCount = useMemo(() => {
    if (!data) return 0;
    const nowMs = Date.parse(data.fetchedAt);
    return data.pullRequests.filter(
      (pr) => pr.ageBand === "critical" && !isSnoozeActive(pr.snooze, pr.updatedOn, nowMs),
    ).length;
  }, [data]);

  return { data, meUuid, count, criticalCount };
}
