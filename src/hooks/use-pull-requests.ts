"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "@/lib/toast";
import { ApiError, getJson, sendJson } from "@/lib/api/http";
import { queryKeys } from "@/lib/query-keys";
import { failureMessage } from "@/hooks/use-config";
import { prKey, type SnoozeKind } from "@/domain/pull-request";

const BACKGROUND_MIN_INTERVAL_SEC = 120;

const userRefSchema = z.object({
  uuid: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable().optional(),
});

const pullRequestItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  url: z.string().url(),
  repository: z.object({
    uuid: z.string(),
    slug: z.string(),
    name: z.string(),
  }),
  author: userRefSchema,
  createdOn: z.string(),
  updatedOn: z.string(),
  approvals: z.number(),
  minApprovals: z.number(),
  changesRequested: z.boolean(),
  hasReviewActivity: z.boolean(),
  reviewState: z.enum(["waiting", "in_review", "changes_requested", "approved"]),
  ageBand: z.enum(["normal", "warning", "critical"]),
  sla: z.object({ warningHours: z.number(), criticalHours: z.number() }),
  reviewers: z.array(
    userRefSchema.extend({ approved: z.boolean(), changesRequested: z.boolean() }),
  ),
  commentCount: z.number(),
  taskCount: z.number(),
  sourceBranch: z.string().nullable(),
  destinationBranch: z.string().nullable(),
  targetKind: z.enum(["production", "release", "hotfix"]).nullable(),
  jiraKey: z.string().nullable(),
  authorMonitored: z.boolean(),
  snooze: z
    .object({
      reason: z.string(),
      kind: z.enum(["24h", "tomorrow", "until_change"]),
      untilMs: z.number().nullable(),
      untilUpdatedOn: z.string().nullable(),
      createdAt: z.string(),
    })
    .nullable(),
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
  /** Continua consultando com a aba oculta (em ritmo mais lento), para badge e notificações. */
  background?: boolean;
}) {
  const queryClient = useQueryClient();
  const key = queryKeys.pullRequestsFor(opts.teamId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchPullRequests(opts.teamId, false),
    refetchIntervalInBackground: opts.background ?? false,
    refetchInterval: () => {
      if (typeof document === "undefined") return false;
      if (document.visibilityState !== "visible") {
        if (!opts.background) return false;
        return Math.max(opts.refreshIntervalSec, BACKGROUND_MIN_INTERVAL_SEC) * 1000;
      }
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

const meSchema = z.object({
  uuid: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
});

export type Me = z.infer<typeof meSchema>;

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => getJson("/api/me", meSchema),
    staleTime: Infinity,
    retry: 1,
  });
}

// --- Tamanho e build --------------------------------------------------------

const insightSchema = z.object({
  size: z
    .object({
      linesAdded: z.number(),
      linesRemoved: z.number(),
      filesChanged: z.number(),
      bucket: z.enum(["P", "M", "G", "GG"]),
    })
    .optional(),
  build: z.enum(["successful", "failed", "in_progress", "none"]).optional(),
});

const insightsResponse = z.object({ insights: z.record(z.string(), insightSchema) });

export type PullRequestInsight = z.infer<typeof insightSchema>;

const NO_INSIGHTS: Record<string, PullRequestInsight> = {};

export function usePullRequestInsights(prs: PullRequestItem[]) {
  const items = prs.slice(0, 50).map((pr) => ({
    repoUuid: pr.repository.uuid,
    id: pr.id,
    updatedOn: pr.updatedOn,
    approved: pr.reviewState === "approved",
  }));
  const keys = items.map((i) => `${prKey(i.repoUuid, i.id)}@${i.updatedOn}@${i.approved}`);
  const query = useQuery({
    queryKey: queryKeys.pullRequestInsights(keys),
    queryFn: () => sendJson("/api/pull-requests/insights", "POST", { items }, insightsResponse),
    enabled: items.length > 0,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
  return query.data?.insights ?? NO_INSIGHTS;
}

// --- Detalhe do drawer ------------------------------------------------------

const detailSchema = z.object({
  description: z.string(),
  comments: z.array(
    z.object({
      id: z.number(),
      createdOn: z.string(),
      author: z.object({ displayName: z.string(), avatarUrl: z.string().nullable() }).nullable(),
      content: z.string(),
      inlinePath: z.string().nullable(),
    }),
  ),
});

export type PullRequestDetail = z.infer<typeof detailSchema>;

export function usePullRequestDetail(pr: PullRequestItem | null) {
  const key = pr ? prKey(pr.repository.uuid, pr.id) : "";
  return useQuery({
    queryKey: queryKeys.pullRequestDetail(key, pr?.updatedOn ?? ""),
    queryFn: () =>
      getJson(
        `/api/pull-requests/${encodeURIComponent(pr!.repository.uuid)}/${pr!.id}`,
        detailSchema,
      ),
    enabled: Boolean(pr),
    staleTime: 5 * 60_000,
  });
}

// --- Ações ------------------------------------------------------------------

export const SNOOZE_LABELS: Record<SnoozeKind, string> = {
  "24h": "Por 24 horas",
  tomorrow: "Até amanhã às 9h",
  until_change: "Até o PR mudar",
};

export function useSnooze() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: queryKeys.pullRequests });

  const set = useMutation({
    mutationFn: (input: { pr: PullRequestItem; reason: string; kind: SnoozeKind }) =>
      sendJson(
        `/api/snoozes/${encodeURIComponent(prKey(input.pr.repository.uuid, input.pr.id))}`,
        "PUT",
        { reason: input.reason, kind: input.kind, updatedOn: input.pr.updatedOn },
      ),
    onSuccess: () => {
      toast.success("PR silenciado.");
      invalidate();
    },
    onError: () => toast.error(failureMessage("silenciar o PR")),
  });

  const clear = useMutation({
    mutationFn: (pr: PullRequestItem) =>
      sendJson(`/api/snoozes/${encodeURIComponent(prKey(pr.repository.uuid, pr.id))}`, "DELETE"),
    onSuccess: () => {
      toast.success("Silêncio removido.");
      invalidate();
    },
    onError: () => toast.error(failureMessage("remover o silêncio")),
  });

  return { set, clear };
}

export function useAddMeAsReviewer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pr: PullRequestItem) =>
      sendJson(
        `/api/pull-requests/${encodeURIComponent(pr.repository.uuid)}/${pr.id}/reviewers/me`,
        "POST",
        undefined,
        z.object({ alreadyReviewer: z.boolean() }),
      ),
    onSuccess: (data) => {
      toast.success(
        data.alreadyReviewer ? "Você já era revisor deste PR." : "Você foi adicionado como revisor.",
      );
      void qc.invalidateQueries({ queryKey: queryKeys.pullRequests });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError && error.status < 500
          ? error.message
          : failureMessage("adicionar você como revisor"),
      ),
  });
}
