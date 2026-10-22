"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { getJson } from "@/lib/api/http";
import { queryKeys } from "@/lib/query-keys";
import { failureMessage } from "@/hooks/use-config";

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
export type PullRequestItem = z.infer<typeof pullRequestItemSchema>;
export type ReviewState = PullRequestItem["reviewState"];
export type AgeBand = PullRequestItem["ageBand"];

function fetchPullRequests(teamId: number | null, force: boolean) {
  const params = new URLSearchParams();
  if (teamId) params.set("teamId", String(teamId));
  if (force) params.set("force", "1");
  return getJson(`/api/pull-requests?${params.toString()}`, responseSchema);
}

export function usePullRequests(opts: {
  teamId: number | null;
  refreshIntervalSec: number;
}) {
  const queryClient = useQueryClient();
  const key = queryKeys.pullRequestsFor(opts.teamId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchPullRequests(opts.teamId, false),
    refetchInterval: () => {
      if (typeof document === "undefined") return false;
      if (document.visibilityState !== "visible") return false;
      return opts.refreshIntervalSec * 1000;
    },
  });

  const refresh = useMutation({
    mutationFn: () => fetchPullRequests(opts.teamId, true),
    onSuccess: (data) => queryClient.setQueryData(key, data),
    onError: () => toast.error(failureMessage("atualizar a fila")),
  });

  return { query, refresh };
}
