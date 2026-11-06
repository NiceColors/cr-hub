"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getJson } from "@/lib/api/http";
import { queryKeys } from "@/lib/query-keys";

const sessionSchema = z.object({
  id: z.number(),
  prKey: z.string(),
  repoUuid: z.string(),
  prId: z.number(),
  title: z.string(),
  url: z.string(),
  repoSlug: z.string(),
  jiraKey: z.string().nullable(),
  timeSpentMs: z.number(),
  completedAt: z.number(),
});

const reviewsSchema = z.object({
  sessions: z.array(sessionSchema),
  latest: z.record(
    z.string(),
    z.object({ timeSpentMs: z.number(), completedAt: z.number() }),
  ),
});

export type ReviewSession = z.infer<typeof sessionSchema>;

export function useReviews() {
  return useQuery({
    queryKey: queryKeys.reviews,
    queryFn: () => getJson("/api/reviews", reviewsSchema),
  });
}
