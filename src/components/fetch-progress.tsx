"use client";

import { useEffect, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { queryKeys } from "@/lib/query-keys";

const SHOW_AFTER_MS = 300;

function useDelayedFlag(active: boolean, delayMs: number) {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [active, delayMs]);
  return active && elapsed;
}

/**
 * Thin indeterminate bar under the header while the queue is being fetched.
 * Scoped to the pull request queries: the token status polls on its own and
 * must not keep the bar on. Fetches faster than 300ms never show it.
 */
export function FetchProgress() {
  const fetching = useIsFetching({ queryKey: queryKeys.pullRequests });
  const mutating = useIsMutating({ mutationKey: queryKeys.pullRequests });
  const visible = useDelayedFlag(fetching + mutating > 0, SHOW_AFTER_MS);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-full h-0.5 overflow-hidden">
      <AnimatePresence>
        {visible ? (
          <motion.div
            key="progress"
            role="progressbar"
            aria-label="Atualizando a fila"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full w-full"
          >
            <div className="h-full w-1/3 animate-progress-indeterminate bg-primary motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-60" />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
