"use client";

import { useSyncExternalStore } from "react";
import {
  NOTIFICATION_TYPES,
  pruneSent,
  type AttentionEvent,
  type AttentionSnapshot,
  type NotificationType,
} from "@/domain/attention";

const PREFS_KEY = "cr:notify-prefs:v1";
const STATE_KEY = "cr:attention:v1";
const SENT_KEY = "cr:notified:v1";

export type NotificationPrefs = Record<NotificationType, boolean>;

export const NOTIFICATION_LABELS: Record<NotificationType, { title: string; hint: string }> = {
  review_requested: {
    title: "Pediram sua revisão",
    hint: "Você passou a constar como revisor de um PR.",
  },
  sla_critical: {
    title: "PR passou do SLA crítico",
    hint: "Só PRs em que você é autor ou revisor.",
  },
  my_pr_approved: {
    title: "Seu PR foi aprovado",
    hint: "Atingiu o mínimo de aprovações do repositório.",
  },
  my_pr_changes_requested: {
    title: "Pediram mudanças no seu PR",
    hint: "Algum revisor marcou “changes requested”.",
  },
};

const DEFAULT_PREFS: NotificationPrefs = Object.fromEntries(
  NOTIFICATION_TYPES.map((t) => [t, true]),
) as NotificationPrefs;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Modo privado ou cota cheia: notificações seguem funcionando, só sem memória.
  }
}

// --- Preferências (store externo para a aba de configuração) ---------------

const prefListeners = new Set<() => void>();
let prefsCache: NotificationPrefs | null = null;

export function getNotificationPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  if (!prefsCache) prefsCache = { ...DEFAULT_PREFS, ...readJson<NotificationPrefs>(PREFS_KEY) };
  return prefsCache;
}

export function setNotificationPref(type: NotificationType, enabled: boolean) {
  prefsCache = { ...getNotificationPrefs(), [type]: enabled };
  writeJson(PREFS_KEY, prefsCache);
  prefListeners.forEach((l) => l());
}

function subscribePrefs(listener: () => void) {
  prefListeners.add(listener);
  return () => prefListeners.delete(listener);
}

export function useNotificationPrefs() {
  return useSyncExternalStore(subscribePrefs, getNotificationPrefs, () => DEFAULT_PREFS);
}

// --- Permissão ---------------------------------------------------------------

export type PermissionState = NotificationPermission | "unsupported";

const permissionListeners = new Set<() => void>();

function readPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function useNotificationPermission() {
  return useSyncExternalStore(
    (listener) => {
      permissionListeners.add(listener);
      return () => permissionListeners.delete(listener);
    },
    readPermission,
    () => "default" as PermissionState,
  );
}

export async function requestNotificationPermission() {
  if (readPermission() === "unsupported") return "unsupported" as const;
  const result = await Notification.requestPermission();
  permissionListeners.forEach((l) => l());
  return result;
}

// --- Estado entre execuções -------------------------------------------------

type StoredState = { meUuid: string; snapshot: AttentionSnapshot };

export function loadAttentionState(meUuid: string): AttentionSnapshot | null {
  const stored = readJson<StoredState>(STATE_KEY);
  return stored && stored.meUuid === meUuid ? stored.snapshot : null;
}

export function saveAttentionState(meUuid: string, snapshot: AttentionSnapshot) {
  writeJson(STATE_KEY, { meUuid, snapshot } satisfies StoredState);
}

export function loadSentIds(): Set<string> {
  return new Set(readJson<string[]>(SENT_KEY) ?? []);
}

export function saveSentIds(sent: Iterable<string>, openKeys: ReadonlySet<string>) {
  writeJson(SENT_KEY, pruneSent(sent, openKeys));
}

// --- Disparo -----------------------------------------------------------------

export async function showAttentionNotification(event: AttentionEvent) {
  if (readPermission() !== "granted") return;
  const options: NotificationOptions = {
    body: event.body,
    // O tag deduplica entre abas: a mesma transição substitui em vez de empilhar.
    tag: event.id,
    data: { url: event.url },
    icon: "/icons/192",
    badge: "/icons/192",
  };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(event.title, options);
      return;
    }
  } catch {
    // Sem service worker: cai para a API direta.
  }
  const notification = new Notification(event.title, options);
  notification.onclick = () => {
    window.open(event.url, "_blank", "noopener");
    notification.close();
  };
}

// --- Badge do app instalado --------------------------------------------------

export function setAppBadge(count: number) {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (count > 0) void nav.setAppBadge?.(count).catch(() => {});
  else void nav.clearAppBadge?.().catch(() => {});
}
