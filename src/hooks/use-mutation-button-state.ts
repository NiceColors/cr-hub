"use client";

import { useEffect, useState } from "react";
import type { MutationStatus } from "@tanstack/react-query";
import type { ButtonState } from "@/components/motion/button/stateful";

const SUCCESS_MS = 1600;
const ERROR_MS = 2400;

/**
 * Maps a mutation to a StatefulButton state: loading while pending, then a
 * brief success or error flash before settling back to idle. The mutation's
 * own data and error stay untouched.
 */
export function useMutationButtonState(mutation: {
  status: MutationStatus;
  submittedAt: number;
}): ButtonState {
  const { status, submittedAt } = mutation;
  const [settledAt, setSettledAt] = useState(0);

  useEffect(() => {
    if (status !== "success" && status !== "error") return;
    const timer = setTimeout(
      () => setSettledAt(submittedAt),
      status === "success" ? SUCCESS_MS : ERROR_MS,
    );
    return () => clearTimeout(timer);
  }, [status, submittedAt]);

  if (status === "pending") return "loading";
  if ((status === "success" || status === "error") && settledAt !== submittedAt) return status;
  return "idle";
}
