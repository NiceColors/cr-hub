"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useEffectEvent, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { EASE_DRAWER, EASE_OUT } from "@/lib/ease";
import { PresenceGate } from "@/lib/presence-gate";
import { cn } from "@/lib/utils";

const subscribeNothing = () => () => {};
const isClient = () => true;
const isServer = () => false;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Painel lateral modal que desliza da direita, com foco preso e Esc para fechar. */
export function SideSheet({
  open,
  onOpenChange,
  ariaLabel,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const mounted = useSyncExternalStore(subscribeNothing, isClient, isServer);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const close = useEffectEvent(() => onOpenChange(false));

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => panelRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      // Um diálogo aberto por cima (ex.: silenciar) leva o foco e trata o próprio Esc e Tab.
      if (event.defaultPrevented || !panelRef.current?.contains(document.activeElement)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <PresenceGate>
          {({ gate }) => (
            <>
              <motion.button
                type="button"
                aria-label="Fechar painel"
                tabIndex={-1}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0.1 : 0.2, ease: EASE_OUT }}
                {...gate}
                onClick={() => onOpenChange(false)}
                className="fixed inset-0 z-[90] cursor-default bg-background/30 backdrop-blur-[2px]"
              />
              <motion.div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel}
                tabIndex={-1}
                initial={reduce ? { opacity: 0 } : { x: "100%" }}
                animate={reduce ? { opacity: 1 } : { x: 0 }}
                exit={reduce ? { opacity: 0 } : { x: "100%" }}
                transition={{ duration: reduce ? 0.12 : 0.32, ease: EASE_DRAWER }}
                {...gate}
                className={cn(
                  "fixed inset-y-0 right-0 z-[95] flex w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl outline-none",
                  className,
                )}
              >
                <button
                  type="button"
                  aria-label="Fechar"
                  onClick={() => onOpenChange(false)}
                  className="absolute right-4 top-4 z-10 inline-flex size-8 items-center justify-center rounded-full bg-foreground/[0.05] text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <X aria-hidden className="size-4" />
                </button>
                {children}
              </motion.div>
            </>
          )}
        </PresenceGate>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
