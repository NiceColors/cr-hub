"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ApiError, getJson, sendJson } from "@/lib/api/http";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "@/lib/toast";
import { failureMessage } from "@/hooks/use-config";
import type { PullRequestItem } from "@/hooks/use-pull-requests";

export const FOCUS_LIMIT = 3;

const focusItemSchema = z.object({
  id: z.number(),
  prKey: z.string(),
  repoUuid: z.string(),
  prId: z.number(),
  title: z.string(),
  url: z.string(),
  repoSlug: z.string(),
  addedAt: z.number(),
  timeSpentMs: z.number(),
  timerStartedAt: z.number().nullable(),
  doneAt: z.number().nullable(),
});

export type FocusItem = z.infer<typeof focusItemSchema>;

const NO_ITEMS: FocusItem[] = [];

export function useFocus() {
  const query = useQuery({
    queryKey: queryKeys.focus,
    queryFn: () => getJson("/api/focus", z.object({ items: z.array(focusItemSchema) })),
  });
  return { query, items: query.data?.items ?? NO_ITEMS };
}

function errorText(error: unknown, action: string) {
  return error instanceof ApiError && error.status < 500 ? error.message : failureMessage(action);
}

export function useFocusActions() {
  const qc = useQueryClient();
  const router = useRouter();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.focus });
    void qc.invalidateQueries({ queryKey: queryKeys.reviews });
  };

  const add = useMutation({
    mutationFn: (pr: PullRequestItem) =>
      sendJson("/api/focus", "POST", {
        repoUuid: pr.repository.uuid,
        prId: pr.id,
        title: pr.title,
        url: pr.url,
        repoSlug: pr.repository.slug,
      }),
    onSuccess: () => {
      toast.success("PR fixado no foco de hoje.");
      invalidate();
    },
    onError: (error) => toast.error(errorText(error, "fixar o PR no foco")),
  });

  const act = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: number;
      action: "start" | "pause" | "complete";
      href?: string;
    }) => sendJson(`/api/focus/${id}`, "PATCH", { action }),
    onSuccess: (_data, { action, href }) => {
      if (action === "complete") {
        toast.success("Revisão concluída e tempo registrado.", {
          action: href
            ? {
                label: "Anotar teste",
                onClick: (item) => {
                  toast.dismiss(item.id);
                  router.push(href);
                },
              }
            : undefined,
        });
      }
      invalidate();
    },
    onError: (error) => toast.error(errorText(error, "atualizar o foco")),
  });

  const remove = useMutation({
    mutationFn: (id: number) => sendJson(`/api/focus/${id}`, "DELETE"),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorText(error, "tirar o PR do foco")),
  });

  return { add, act, remove };
}

/** Tempo acumulado mais o trecho em andamento. */
export function elapsedMs(item: FocusItem, nowMs: number) {
  return item.timeSpentMs + (item.timerStartedAt ? Math.max(0, nowMs - item.timerStartedAt) : 0);
}

export function formatTimer(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
