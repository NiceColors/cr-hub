"use client";

import { useMemo } from "react";
import { PullRequestActionsProvider } from "@/components/pull-requests/pull-request-actions";
import { PullRequestDrawer } from "@/components/pull-requests/pull-request-drawer";
import { prKey } from "@/domain/pull-request";
import { useAwaitingReview } from "@/hooks/use-awaiting-review";
import { useSettings } from "@/hooks/use-config";
import { usePullRequestInsights } from "@/hooks/use-pull-requests";

const NONE: never[] = [];

/** Detalhe do PR com as mesmas ações da Fila, a partir da fila global já em cache. */
export function LeadPullRequestDrawer({
  prKey: key,
  onOpen,
  onClose,
}: {
  prKey: string | null;
  onOpen: (key: string) => void;
  onClose: () => void;
}) {
  const { data, meUuid } = useAwaitingReview();
  const jiraBaseUrl = useSettings().data?.jiraBaseUrl ?? null;
  const pr = useMemo(
    () => (key ? (data?.pullRequests.find((p) => prKey(p.repository.uuid, p.id) === key) ?? null) : null),
    [data, key],
  );
  const insights = usePullRequestInsights(pr ? [pr] : NONE);

  return (
    <PullRequestActionsProvider
      meUuid={meUuid}
      onOpenPreview={(next) => onOpen(prKey(next.repository.uuid, next.id))}
    >
      <PullRequestDrawer
        pr={pr}
        insight={pr ? insights[prKey(pr.repository.uuid, pr.id)] : undefined}
        jiraBaseUrl={jiraBaseUrl}
        onClose={onClose}
      />
    </PullRequestActionsProvider>
  );
}
