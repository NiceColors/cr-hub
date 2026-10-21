"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

const pullRequestAuthorSchema = z.object({
  uuid: z.string(),
  nickname: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
});

const pullRequestItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  url: z.string().url(),
  repoSlug: z.string(),
  repoName: z.string(),
  author: pullRequestAuthorSchema,
  createdOn: z.string(),
  participants: z
    .array(z.object({ approved: z.boolean().nullable().optional(), state: z.string().nullable().optional() }))
    .default([]),
});

const responseSchema = z.object({
  cached: z.boolean(),
  cachedAtMs: z.number().optional(),
  generatedAtMs: z.number(),
  refreshIntervalSec: z.number(),
  pullRequests: z.array(pullRequestItemSchema),
  errors: z.array(z.object({ repoSlug: z.string(), status: z.number().optional(), message: z.string() })),
  rateLimit: z
    .object({
      retryAfterSeconds: z.number(),
    })
    .nullable()
    .optional(),
  forceLimitedForMs: z.number().optional(),
});

export type PullRequestsResponse = z.infer<typeof responseSchema>;

type Filters = {
  squadId?: number | null;
  repoSlug?: string | null;
};

async function fetchPullRequests(filters: Filters, force: boolean) {
  const params = new URLSearchParams();
  if (filters.squadId) params.set("squadId", String(filters.squadId));
  if (filters.repoSlug) params.set("repoSlug", filters.repoSlug);
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

