import type { AnimatedToast, AnimatedToastAction, ToastStatus } from "@/components/motion/animated-toast-stack";

const DEFAULT_DURATION_MS = 4200;
const MAX_TOASTS = 5;
const NO_TOASTS: AnimatedToast[] = [];

let toasts: AnimatedToast[] = NO_TOASTS;
let seed = 0;
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit(next: AnimatedToast[]) {
  toasts = next;
  for (const listener of listeners) listener();
}

function dismiss(id: string) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  emit(toasts.filter((t) => t.id !== id));
}

function show(status: ToastStatus, title: string, extra?: { action?: AnimatedToastAction; description?: string }) {
  const id = `toast-${Date.now()}-${seed++}`;
  emit(
    [
      ...toasts,
      {
        id,
        title,
        status,
        dismissible: true,
        createdAt: Date.now(),
        action: extra?.action,
        description: extra?.description,
      },
    ].slice(-MAX_TOASTS),
  );
  const duration = extra?.action ? 8000 : DEFAULT_DURATION_MS;
  timers.set(
    id,
    setTimeout(() => dismiss(id), duration),
  );
  return id;
}

export const toast = {
  success: (title: string, extra?: { action?: AnimatedToastAction; description?: string }) =>
    show("success", title, extra),
  warning: (title: string, extra?: { action?: AnimatedToastAction; description?: string }) =>
    show("warning", title, extra),
  error: (title: string, extra?: { action?: AnimatedToastAction; description?: string }) =>
    show("error", title, extra),
  info: (title: string, extra?: { action?: AnimatedToastAction; description?: string }) =>
    show("info", title, extra),
  dismiss,
};

export function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts() {
  return toasts;
}

export function getServerToasts() {
  return NO_TOASTS;
}
