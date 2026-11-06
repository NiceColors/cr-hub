"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { UNLINKED_KIND } from "@/domain/dashboard-features";
import { PROJECT_KINDS, PROJECT_STATUSES } from "@/domain/project";
import { getJson } from "@/lib/api/http";
import { queryKeys } from "@/lib/query-keys";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const count = z.number().int().nonnegative();
const hours = z.number().nullable();

const windowStatsSchema = z.object({
  opened: count,
  closed: count,
  firstReviewMedianHours: hours,
  cycleMedianHours: hours,
});

const queuePointShape = {
  total: count,
  waiting: count,
  inReview: count,
  approved: count,
  normal: count,
  warning: count,
  critical: count,
};

const dashboardSchema = z.object({
  days: z.array(day),
  period: z.object({ current: windowStatsSchema, previous: windowStatsSchema.nullable() }),
  queue: z.array(z.object({ day, ...queuePointShape })),
  repositories: z.array(z.object({ id: z.string(), name: z.string(), values: z.array(count) })),
  firstReview: z.array(
    z.object({
      day,
      reviewed: count,
      medianHours: hours,
      p75Hours: hours,
    }),
  ),
  firstReviewOverall: z.object({
    reviewed: count,
    medianHours: hours,
    p75Hours: hours,
  }),
  throughput: z.array(z.object({ day, opened: count, closed: count })),
  activity: z.object({ today: day, counts: z.record(z.string(), count) }),
});

const teamComparisonSchema = z.object({
  days: z.array(day),
  teams: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      members: count,
      open: z.array(count),
      waiting: z.array(count),
      critical: z.array(count),
      opened: z.array(count),
      closed: z.array(count),
      now: z.object(queuePointShape),
      stats: windowStatsSchema,
    }),
  ),
});

const workKind = z.enum([...PROJECT_KINDS, UNLINKED_KIND]);

const featureBoardSchema = z.object({
  days: z.array(day),
  features: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      kind: z.enum(PROJECT_KINDS),
      status: z.enum(PROJECT_STATUSES),
      createdAt: z.number(),
      updatedAt: z.number(),
      stages: z.object({
        waiting: count,
        inReview: count,
        approved: count,
        closed: count,
        untracked: count,
      }),
      total: count,
      closedInWindow: count,
      oldestOpenHours: hours,
      cycleMedianHours: hours,
      changesCycles: count,
      lastActivityAt: z.number().nullable(),
      authors: z.array(z.string()),
      repos: z.array(z.string()),
    }),
  ),
  deliveries: z.array(z.object({ id: workKind, values: z.array(count) })),
  openByKind: z.array(
    z.object({ id: workKind, waiting: count, inReview: count, approved: count, total: count }),
  ),
});

export type DashboardResponse = z.infer<typeof dashboardSchema>;
export type TeamComparisonResponse = z.infer<typeof teamComparisonSchema>;
export type FeatureBoardResponse = z.infer<typeof featureBoardSchema>;

const REFRESH_MS = 60_000;

function dashboardUrl(path: string, params: { teamId?: number | null; days: number }) {
  const search = new URLSearchParams({ days: String(params.days) });
  if (params.teamId) search.set("teamId", String(params.teamId));
  return `${path}?${search}`;
}

export function useDashboard(teamId: number | null, days: number) {
  return useQuery({
    queryKey: queryKeys.dashboard(teamId, days),
    queryFn: () => getJson(dashboardUrl("/api/dashboard", { teamId, days }), dashboardSchema),
    refetchInterval: REFRESH_MS,
    placeholderData: (previous) => previous,
  });
}

export function useTeamComparison(days: number) {
  return useQuery({
    queryKey: queryKeys.dashboardTeams(days),
    queryFn: () => getJson(dashboardUrl("/api/dashboard/teams", { days }), teamComparisonSchema),
    refetchInterval: REFRESH_MS,
    placeholderData: (previous) => previous,
  });
}

export function useFeatureBoard(teamId: number | null, days: number) {
  return useQuery({
    queryKey: queryKeys.dashboardFeatures(teamId, days),
    queryFn: () =>
      getJson(dashboardUrl("/api/dashboard/features", { teamId, days }), featureBoardSchema),
    refetchInterval: REFRESH_MS,
    placeholderData: (previous) => previous,
  });
}
