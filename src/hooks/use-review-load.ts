"use client";

import { useMemo } from "react";
import { reviewLoadByMember } from "@/domain/pull-request";
import { useSettings } from "@/hooks/use-config";
import { usePullRequests } from "@/hooks/use-pull-requests";

/** Carga de revisão por membro, sobre a fila global (a mesma consulta do contador da aba). */
export function useReviewLoad() {
  const settings = useSettings();
  const { query } = usePullRequests({
    teamId: null,
    refreshIntervalSec: settings.data?.pollIntervalSeconds ?? 30,
  });
  const data = query.data;
  return useMemo(
    () => (data ? reviewLoadByMember(data.pullRequests.filter((pr) => pr.authorMonitored)) : null),
    [data],
  );
}
