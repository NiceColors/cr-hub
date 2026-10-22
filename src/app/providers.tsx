"use client";

import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import { DURATION, EASE_OUT } from "@/components/motion/tokens";

const DEFAULT_TRANSITION = { duration: DURATION.base, ease: EASE_OUT };

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: true,
            refetchIntervalInBackground: false,
          },
        },
      }),
  );

  useEffect(() => {
    function onVisibilityChange() {
      focusManager.setFocused(document.visibilityState === "visible");
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    onVisibilityChange();
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user" transition={DEFAULT_TRANSITION}>
        {children}
      </MotionConfig>
    </QueryClientProvider>
  );
}
