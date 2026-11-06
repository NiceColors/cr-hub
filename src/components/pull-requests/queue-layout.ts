"use client";

import { useSyncExternalStore } from "react";

export type QueueLayout = "table" | "calendar";

const STORAGE_KEY = "cr-tracker:queue-layout:v1";
const listeners = new Set<() => void>();
let cached: QueueLayout | null = null;

function read(): QueueLayout {
  try {
    return localStorage.getItem(STORAGE_KEY) === "calendar" ? "calendar" : "table";
  } catch {
    return "table";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cached = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => (cached ??= read());
const getServerSnapshot = (): QueueLayout => "table";

function setQueueLayout(next: QueueLayout) {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Modo privado ou cota cheia: vale só nesta sessão.
  }
  cached = next;
  listeners.forEach((listener) => listener());
}

/** Lista ou calendário na Fila de CRs, lembrado entre sessões. */
export function useQueueLayout() {
  const layout = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [layout, setQueueLayout] as const;
}
