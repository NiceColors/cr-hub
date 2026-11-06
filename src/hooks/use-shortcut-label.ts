"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const isApple = () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

/** "⌘K" no macOS e iOS, "Ctrl K" no resto. O servidor renderiza "Ctrl K". */
export function useShortcutLabel(key: string) {
  const apple = useSyncExternalStore(subscribe, isApple, () => false);
  return apple ? `⌘${key}` : `Ctrl ${key}`;
}
