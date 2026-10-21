"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

const pullRequestItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  url: z.string().url(),
  repository: z.object({
    uuid: z.string(),
    slug: z.string(),
    name: z.string(),
  }),
  author: z.object({
    uuid: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable().optional(),
  }),
  createdOn: z.string(),
  updatedOn: z.string(),
  approvals: z.number(),
  minApprovals: z.number(),
  changesRequested: z.boolean(),
  hasReviewActivity: z.boolean(),
  reviewState: z.enum(["waiting", "in_review", "changes_requested", "approved"]),
  ageBand: z.enum(["normal", "warning", "critical"]),
});

const responseSchema = z.object({
  pullRequests: z.array(pullRequestItemSchema),
  errors: z.array(
    z.object({
      repositorySlug: z.string(),
      status: z.number().optional(),
      message: z.string(),
    }),
  ),
  fetchedAt: z.string(),
  fromCache: z.boolean(),
  rateLimit: z.object({ retryAfterSeconds: z.number() }).optional(),
});

export type PullRequestsResponse = z.infer<typeof responseSchema>;

type Filters = {
  teamId?: number | null;
};

async function fetchPullRequests(filters: Filters, force: boolean) {
  const params = new URLSearchParams();
  if (filters.teamId) params.set("teamId", String(filters.teamId));
  if (force) params.set("force", "1");

  const res = await fetch(`/api/pull-requests?${params.toString()}`, {
    method: "GET",
  });
  const json = await res.json();
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Resposta inválida do servidor (/api/pull-requests)");
  }
  return parsed.data;
}

export function usePullRequests(opts: {
  filters: Filters;
  refreshIntervalSec: number;
}) {
  const queryClient = useQueryClient();
  const key = ["pull-requests", opts.filters] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchPullRequests(opts.filters, false),
    refetchInterval: () => {
      if (typeof document === "undefined") return false;
      if (document.visibilityState !== "visible") return false;
      return opts.refreshIntervalSec * 1000;
    },
  });

  const refreshNow = async () => {
    const data = await fetchPullRequests(opts.filters, true);
    queryClient.setQueryData(key, data);
    return data;
  };

  return { query, refreshNow };
}

