import type { AnimatedToast, ToastStatus } from "@/components/motion/animated-toast-stack";

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

function show(status: ToastStatus, title: string) {
  const id = `toast-${Date.now()}-${seed++}`;
  emit([...toasts, { id, title, status, dismissible: true, createdAt: Date.now() }].slice(-MAX_TOASTS));
  timers.set(
    id,
    setTimeout(() => dismiss(id), DEFAULT_DURATION_MS),
  );
  return id;
}

export const toast = {
  success: (title: string) => show("success", title),
  warning: (title: string) => show("warning", title),
  error: (title: string) => show("error", title),
  info: (title: string) => show("info", title),
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
