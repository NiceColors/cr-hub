"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getJson } from "@/lib/api/http";
import { queryKeys } from "@/lib/query-keys";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const count = z.number().int().nonnegative();

const dashboardSchema = z.object({
  days: z.array(day),
  queue: z.array(
    z.object({
      day,
      total: count,
      waiting: count,
      inReview: count,
      approved: count,
      normal: count,
      warning: count,
      critical: count,
    }),
  ),
  repositories: z.array(z.object({ id: z.string(), name: z.string(), values: z.array(count) })),
  firstReview: z.array(
    z.object({
      day,
      reviewed: count,
      medianHours: z.number().nullable(),
      p75Hours: z.number().nullable(),
    }),
  ),
  firstReviewOverall: z.object({
    reviewed: count,
    medianHours: z.number().nullable(),
    p75Hours: z.number().nullable(),
  }),
  throughput: z.array(z.object({ day, opened: count, closed: count })),
  activity: z.object({ today: day, counts: z.record(z.string(), count) }),
});

export type DashboardResponse = z.infer<typeof dashboardSchema>;

const REFRESH_MS = 60_000;

export function useDashboard(teamId: number | null) {
  return useQuery({
    queryKey: queryKeys.dashboard(teamId),
    queryFn: () =>
      getJson(`/api/dashboard${teamId ? `?teamId=${teamId}` : ""}`, dashboardSchema),
    refetchInterval: REFRESH_MS,
  });
}
