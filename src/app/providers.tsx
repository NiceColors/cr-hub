"use client";

import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
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

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

