"use client";

import { useMemo } from "react";
import { isAwaitingReviewBy } from "@/domain/pull-request";
import { useSettings } from "@/hooks/use-config";
import { useMe, usePullRequests } from "@/hooks/use-pull-requests";

/**
 * Fila global (sem time) com o dono do token e quantos PRs esperam a revisão
 * dele. Continua consultando com a aba oculta, para o badge e as notificações.
 */
export function useAwaitingReview() {
  const settings = useSettings();
  const me = useMe();
  const { query } = usePullRequests({
    teamId: null,
    refreshIntervalSec: settings.data?.pollIntervalSeconds ?? 30,
    background: true,
  });

  const meUuid = me.data?.uuid ?? null;
  const data = query.data;
  const count = useMemo(() => {
    if (!data || !meUuid) return 0;
    const nowMs = Date.parse(data.fetchedAt);
    return data.pullRequests.filter((pr) => isAwaitingReviewBy(pr, meUuid, nowMs)).length;
  }, [data, meUuid]);

  return { data, meUuid, count };
}
