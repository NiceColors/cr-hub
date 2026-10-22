"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { buildAttentionSnapshot, detectTransitions } from "@/domain/attention";
import { prKey } from "@/domain/pull-request";
import { useAwaitingReview } from "@/hooks/use-awaiting-review";
import {
  getNotificationPrefs,
  loadAttentionState,
  loadSentIds,
  saveAttentionState,
  saveSentIds,
  setAppBadge,
  showAttentionNotification,
} from "@/lib/notifications";

const APP_TITLE = "CR Tracker";

/**
 * Mantém o app "lembrando" o usuário em qualquer página: contador no título da
 * aba, badge do PWA instalado e notificações por transição.
 */
export function AttentionSync() {
  const pathname = usePathname();
  const { data, meUuid, count: awaitingCount } = useAwaitingReview();

  useEffect(() => {
    document.title = awaitingCount > 0 ? `(${awaitingCount}) ${APP_TITLE}` : APP_TITLE;
    setAppBadge(awaitingCount);
  }, [awaitingCount, pathname]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (!data || !meUuid || data.errors.length > 0) return;
    const nowMs = Date.now();
    const prev = loadAttentionState(meUuid);
    const next = buildAttentionSnapshot(data.pullRequests, meUuid, nowMs);
    const sent = loadSentIds();
    const events = detectTransitions({
      prev,
      next,
      prs: data.pullRequests,
      meUuid,
      nowMs,
      sent,
      enabled: getNotificationPrefs(),
    });
    for (const event of events) {
      sent.add(event.id);
      void showAttentionNotification(event);
    }
    saveAttentionState(meUuid, next);
    saveSentIds(
      sent,
      new Set(data.pullRequests.map((pr) => prKey(pr.repository.uuid, pr.id))),
    );
  }, [data, meUuid]);

  return null;
}
