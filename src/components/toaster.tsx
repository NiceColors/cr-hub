"use client";

import { useSyncExternalStore } from "react";
import { AnimatedToastStack } from "@/components/motion/animated-toast-stack";
import { getServerToasts, getToasts, subscribeToasts, toast } from "@/lib/toast";

export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getServerToasts);
  return (
    <AnimatedToastStack
      toasts={toasts}
      onDismiss={toast.dismiss}
      position="bottom-right"
      fixed
      classNames={{ title: "whitespace-normal" }}
    />
  );
}
